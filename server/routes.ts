import { Express, Request, Response } from 'express';
import { Server } from 'http';
import { createServer } from 'http';
import { z } from 'zod';
import { db } from '../db';
import { profiles, tours, tourMatches, groupProfiles, watchlists, tourPriorities } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { searchTours } from './providers';
import { analyzeTourRequest, calculateTourMatchScore } from './services/openrouter';
import { startBot } from './bot';
import { startMonitoring } from './services/monitoring';
import { createOrUpdateGroupProfile, aggregateGroupProfiles, handleGroupVote } from './services/groups';
import { 
  userIdSchema,
  createProfileSchema,
  updateProfileSchema,
  analyzeRequestSchema,
  tourSearchSchema,
  createGroupSchema,
  tourVoteSchema,
  watchlistSchema,
  profileSchema
} from './validators/schemas';
import { 
  validateBody, 
  validateQuery, 
  validateParams,
  validateAll,
  createValidatedHandler
} from './middleware/validation';
import { asyncHandler, NotFoundError, ValidationError } from './utils/errors';
import apiLogger from './utils/logger';
import { getHealthStatus, getReadinessStatus, getLivenessStatus } from './monitoring/health';
import { setupMetrics } from './monitoring/metrics';
import { cache, cacheKeys, CACHE_TTL } from './services/cache';
import { apiVersionMiddleware } from './middleware/apiVersion';
import v1Routes from './routes/v1';
import { setupSwagger } from './docs/swagger';
import authRoutes from './routes/auth';
import { requireAuth, optionalAuth, authorizeOwner } from './middleware/auth';

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);

  // Запускаем бота
  const bot = await startBot(server);
  
  // Запускаем мониторинг
  startMonitoring();

  // Setup Prometheus metrics
  setupMetrics(app);

  // API versioning middleware
  app.use('/api', apiVersionMiddleware);

  // Authentication routes (version-agnostic)
  app.use('/api/auth', authRoutes);

  // Mount versioned routes
  app.use('/api/v1', v1Routes);

  // Setup Swagger documentation
  setupSwagger(app);

  // Health check endpoints (version-agnostic)
  /**
   * @swagger
   * /health:
   *   get:
   *     summary: Health check
   *     tags: [Health]
   *     responses:
   *       200:
   *         description: Service is healthy
   *       503:
   *         description: Service is unhealthy
   */
  app.get('/api/health', asyncHandler(async (req: any, res: any) => {
    const health = await getHealthStatus();
    res.status(health.status === 'healthy' ? 200 : 503).json(health);
  }));

  // Kubernetes-style health checks
  app.get('/api/health/ready', asyncHandler(async (req: any, res: any) => {
    const { ready, checks } = await getReadinessStatus();
    res.status(ready ? 200 : 503).json({ ready, checks });
  }));

  app.get('/api/health/live', (req, res) => {
    const liveness = getLivenessStatus();
    res.json(liveness);
  });

  // Legacy endpoints (redirect to v1)
  app.get('/api/profile/:userId', (req, res) => {
    res.redirect(301, `/api/v1/profile/${req.params.userId}`);
  });

  // DEPRECATED: Old profile endpoint (to be removed)
  app.get('/api/v0/profile/:userId', asyncHandler(async (req: any, res: any) => {
    const { userId } = req.params;
    const cacheKey = cacheKeys.profile(userId);
    
    // Проверяем кэш
    const cached = await cache.get(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    
    const [profile] = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!profile) {
      throw new NotFoundError('Profile not found');
    }

    // Получаем приоритеты
    const [priorities] = await db.select()
      .from(tourPriorities)
      .where(eq(tourPriorities.userId, userId))
      .limit(1);

    const result = { ...profile, priorities: priorities || profile.priorities };
    
    // Сохраняем в кэш
    await cache.set(cacheKey, result, CACHE_TTL.PROFILE);
    
    res.json(result);
  }));

  // Создать или обновить профиль
  app.post('/api/profile', 
    requireAuth,
    authorizeOwner('userId'),
    validateBody(createProfileSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const profileData = req.body;
      const { userId, priorities, ...rest } = profileData;

      // Сохраняем профиль
      const [existingProfile] = await db.select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      let profile;
      if (existingProfile) {
        [profile] = await db.update(profiles)
          .set({ ...rest, priorities, updatedAt: new Date() })
          .where(eq(profiles.userId, userId))
          .returning();
      } else {
        [profile] = await db.insert(profiles)
          .values({ userId, ...rest, priorities })
          .returning();
      }

      // Сохраняем приоритеты отдельно
      if (priorities) {
        const [existingPriorities] = await db.select()
          .from(tourPriorities)
          .where(eq(tourPriorities.userId, userId))
          .limit(1);

        if (existingPriorities) {
          await db.update(tourPriorities)
            .set({ ...priorities, updatedAt: new Date() })
            .where(eq(tourPriorities.userId, userId));
        } else {
          await db.insert(tourPriorities)
            .values({ userId, ...priorities });
        }
      }

      // Инвалидируем кэш
      await cache.del(cacheKeys.profile(userId));
      
      res.json(profile);
    }));

  // Анализ текстового запроса
  app.post('/api/analyze-request', 
    validateBody(analyzeRequestSchema),
    asyncHandler(async (req: Request, res: Response) => {
    try {
      const { message, userId } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      const preferences = await analyzeTourRequest(message);
      
      // Если указан userId, сохраняем предпочтения
      if (userId && preferences) {
        await db.update(profiles)
          .set({
            vacationType: preferences.vacationType,
            countries: preferences.countries,
            budget: preferences.budget,
            startDate: preferences.startDate,
            endDate: preferences.endDate,
            tripDuration: preferences.duration,
            peopleCount: preferences.peopleCount,
            priorities: preferences.priorities,
            updatedAt: new Date()
          })
          .where(eq(profiles.userId, userId));
      }

        res.json(preferences);
      } catch (error) {
        apiLogger.error('Error analyzing request:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }));

  // Поиск туров
  app.get('/api/tours', 
    validateQuery(tourSearchSchema),
    asyncHandler(async (req: Request, res: Response) => {
      try {
      const { userId, countries, budget, startDate, endDate } = req.query;

      let searchParams: any = {};
      
      if (userId) {
        const [profile] = await db.select()
          .from(profiles)
          .where(eq(profiles.userId, userId as string))
          .limit(1);

        if (profile) {
          searchParams = {
            countries: profile.countries as string[],
            budget: profile.budget || undefined,
            startDate: profile.startDate || undefined,
            endDate: profile.endDate || undefined,
            duration: profile.tripDuration || undefined,
            peopleCount: profile.peopleCount || 2
          };
        }
      } else {
        searchParams = {
          countries: countries ? (countries as string).split(',') : undefined,
          budget: budget ? parseInt(budget as string) : undefined,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined
        };
      }

      const tours = await searchTours(searchParams);

      // Если есть профиль, считаем соответствие
      if (userId) {
        const [profile] = await db.select()
          .from(profiles)
          .where(eq(profiles.userId, userId as string))
          .limit(1);

        if (profile && profile.priorities) {
          const toursWithScores = await Promise.all(
            tours.map(async (tour: any) => {
              const { score, details, analysis } = await calculateTourMatchScore(
                tour,
                searchParams,
                profile.priorities as Record<string, number>
              );
              return { ...tour, matchScore: score, matchDetails: details, aiAnalysis: analysis };
            })
          );

          // Сортируем по соответствию
          toursWithScores.sort((a: any, b: any) => b.matchScore - a.matchScore);
          return res.json(toursWithScores);
        }
      }

      res.json(tours);
      } catch (error) {
        apiLogger.error('Error searching tours:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }));

  // Создать watchlist
  app.post('/api/watchlist', 
    validateBody(watchlistSchema),
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const watchlistData = req.body;
        const { userId } = watchlistData;

        if (!userId) {
          return res.status(400).json({ error: 'userId is required' });
        }

        const [watchlist] = await db.insert(watchlists)
          .values(watchlistData)
          .returning();

        res.json(watchlist);
      } catch (error) {
        apiLogger.error('Error creating watchlist:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }));

  // Получить watchlists пользователя
  app.get('/api/watchlist/:userId', 
    validateParams(z.object({ userId: userIdSchema })),
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const { userId } = req.params;
        const userWatchlists = await db.select()
          .from(watchlists)
          .where(eq(watchlists.userId, userId));

        res.json(userWatchlists);
      } catch (error) {
        apiLogger.error('Error fetching watchlists:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }));

  // Групповые функции
  app.post('/api/group/create', 
    validateBody(createGroupSchema),
    asyncHandler(async (req: Request, res: Response) => {
      const { chatId, chatTitle, memberIds } = req.body;

      const groupId = await createOrUpdateGroupProfile(chatId, chatTitle, memberIds);
      await aggregateGroupProfiles(groupId);

      res.json({ groupId, message: 'Group profile created' });
    }));

  // Голосование за тур
  app.post('/api/group/vote', 
    validateBody(tourVoteSchema),
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const { groupId, tourId, userId, vote, comment } = req.body;

        if (!groupId || !tourId || !userId || !vote) {
          return res.status(400).json({ error: 'Missing required fields' });
        }

        const voteCount = await handleGroupVote(groupId, tourId, userId, vote, comment);
        res.json(voteCount);
      } catch (error) {
        apiLogger.error('Error handling vote:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }));

  // Получить группу по chatId
  app.get('/api/group/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      const [group] = await db.select()
        .from(groupProfiles)
        .where(eq(groupProfiles.chatId, chatId))
        .limit(1);

      if (!group) {
        return res.status(404).json({ error: 'Group not found' });
      }

      res.json(group);
    } catch (error) {
      apiLogger.error('Error fetching group:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Получить рекомендованные туры для пользователя
  app.get('/api/tours/recommended/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      
      const matches = await db.select()
        .from(tourMatches)
        .leftJoin(tours, eq(tourMatches.tourId, tours.id))
        .where(eq(tourMatches.userId, userId))
        .orderBy(desc(tourMatches.matchScore))
        .limit(10);

      const recommendedTours = matches
        .filter(m => m.tours)
        .map(m => ({
          ...m.tours,
          matchScore: m.tour_matches.matchScore,
          matchDetails: m.tour_matches.matchDetails
        }));

      res.json(recommendedTours);
    } catch (error) {
      apiLogger.error('Error fetching recommended tours:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return server;
}