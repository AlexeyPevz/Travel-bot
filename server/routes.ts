import { Express, Request, Response } from 'express';
import { Server } from 'http';
import { z } from 'zod';
import { db } from '../db';
import { profiles, tours, tourMatches, groupProfiles, watchlists, tourPriorities } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { searchTours } from './providers';
import { analyzeTourRequest, calculateTourMatchScore } from './services/openrouter';
import { startBot, getBot } from './bot';
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
import { cache, cacheKeys, CACHE_TTL } from './services/cache';
import { apiVersionMiddleware } from './middleware/apiVersion';
import v1Routes from './routes/v1';
import v2Routes from './routes/v2';
import { setupSwagger } from './docs/swagger';
import authRoutes from './routes/auth';
import { requireAuth, optionalAuth, authorizeOwner } from './middleware/auth';
import { fetchToursFromAllProviders } from './providers/providers';
import { hotelDeduplicationService } from './services/hotelDeduplication';

export async function registerRoutes(app: Express, httpServer?: Server): Promise<void> {
  // Запускаем бота НЕБЛОКИРУЮЩЕ, если не отключен флагом
  const disableBot = process.env.DISABLE_BOT === 'true';
  if (!disableBot && httpServer) {
    (async () => {
      try {
        await startBot(httpServer);
      } catch (err) {
        console.error('Bot startup failed, continuing without bot:', err);
      }
    })();
  }
  
  // Запускаем мониторинг неблокирующе
  (async () => {
    try {
      startMonitoring();
    } catch (err) {
      console.error('Monitoring startup failed:', err);
    }
  })();

  // API versioning middleware
  app.use('/api', apiVersionMiddleware);

  // Telegram webhook (если включен)
  app.post('/api/telegram/webhook', asyncHandler(async (req: Request, res: Response) => {
    try {
      if (process.env.TELEGRAM_USE_WEBHOOK !== 'true') {
        return res.status(404).json({ ok: false, description: 'Webhook disabled' });
      }
      const update = req.body;
      const bot = getBot();
      // Передаем апдейт напрямую боту
      await (bot as any).processUpdate(update);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ ok: false });
    }
  }));

  // Authentication routes (version-agnostic)
  app.use('/api/auth', authRoutes);

  // Mount versioned routes
  app.use('/api/v1', v1Routes);
  app.use('/api/v2', v2Routes);

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
      // Сбрасываем кэш поисков туров (параметры зависят от профиля)
      await cache.clearPattern('tours:search:*');
      
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
            startDate: preferences.startDate ? preferences.startDate.toISOString().split('T')[0] : null,
            endDate: preferences.endDate ? preferences.endDate.toISOString().split('T')[0] : null,
            tripDuration: preferences.duration,
            adults: preferences.peopleCount || 2,
            children: 0,
            priorities: preferences.priorities,
            updatedAt: new Date()
          })
          .where(eq(profiles.userId, userId));
      }

        // Optional sort param for legacy
        const sortBy = (req.query.sortBy as string) || 'match';
        (preferences as any)._sortBy = sortBy;
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
      const { userId, countries, budget, startDate, endDate } = req.query as any;

      let searchParams: any = {};
      
      if (userId) {
        const [profile] = await db.select()
          .from(profiles)
          .where(eq(profiles.userId, userId as string))
          .limit(1);

        if (profile) {
          const countries = profile.countries as string[] || [];
          searchParams = {
            destination: countries[0] || 'Турция',
            budget: profile.budget || undefined,
            startDate: profile.startDate ? new Date(profile.startDate) : undefined,
            endDate: profile.endDate ? new Date(profile.endDate) : undefined,
            tripDuration: profile.tripDuration || undefined,
            departureCity: (profile as any).departureCity || 'Москва',
            adults: profile.adults || 2,
            children: profile.children || 0,
            childrenAges: (profile as any).childrenAges || []
          };
        }
      } else {
        const countriesList = countries ? (countries as string).split(',') : ['Турция'];
        searchParams = {
          destination: countriesList[0],
          budget: budget ? parseInt(budget as string) : undefined,
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          departureCity: 'Москва',
          adults: 2,
          children: 0
        };
      }

      // Попытка отдать из кэша
      const toursCacheKey = cacheKeys.tourSearch({ ...(searchParams || {}), userId: userId || null });
      const cachedTours = await cache.get<any[]>(toursCacheKey);
      if (cachedTours) {
        // Apply optional sort
        const sortBy = ((req.query as any).sortBy as string) || 'match';
        const sorted = sortTours(cachedTours, sortBy);
        return res.json({ tours: sorted });
      }

      const found = await searchTours(searchParams);

      // Если есть профиль, считаем соответствие
      if (userId) {
        const [profile] = await db.select()
          .from(profiles)
          .where(eq(profiles.userId, userId as string))
          .limit(1);

        if (profile && profile.priorities) {
          const toursWithScores = await Promise.all(
            found.map(async (tour: any) => {
              const { score, details, analysis } = await calculateTourMatchScore(
                tour,
                searchParams,
                profile.priorities as Record<string, number>
              );
              return { ...tour, matchScore: score, matchDetails: details, aiAnalysis: analysis };
            })
          );

          // Сортируем по соответствию либо по параметру sortBy
          const sortBy = ((req.query as any).sortBy as string) || 'match';
          const sorted = sortTours(toursWithScores, sortBy);
          await cache.set(toursCacheKey, sorted, CACHE_TTL.TOUR_SEARCH);
          return res.json({ tours: sorted });
        }
      }

      const sortBy = ((req.query as any).sortBy as string) || 'price';
      const sorted = sortTours(found, sortBy);
      await cache.set(toursCacheKey, sorted, CACHE_TTL.TOUR_SEARCH);
      res.json({ tours: sorted });
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

  app.post("/api/tours/search", async (req: Request, res: Response) => {
    const { 
      destination, 
      startDate, 
      endDate, 
      adults = 2, 
      children = 0,
      childrenAges = [],
      departureCity = 'Москва',
      nights,
      budget,
      mealType,
      hotelStars,
      searchId,
      userId
    } = req.body;
    
    // Валидация обязательных параметров
    if (!destination || !startDate || !nights) {
      return res.status(400).json({ 
        error: "Необходимо указать направление, дату начала и количество ночей" 
      });
    }

    try {
      // Поиск туров через провайдеров
      const searchParams = {
        destination,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : new Date(new Date(startDate).getTime() + nights * 24 * 60 * 60 * 1000),
        adults,
        children,
        childrenAges,
        departureCity,
        nights,
        budget,
        mealType,
        hotelStars
      };

      // Получаем туры от всех провайдеров
      const tours = await fetchToursFromAllProviders(searchParams);
      
      // Импортируем сервис дедупликации
      const { hotelDeduplicationService } = await import('./services/hotelDeduplication');
      
      // Группируем туры по отелям и создаем карточки для MiniApp
      const tourCards = hotelDeduplicationService.groupToursByHotel(tours);
      
      // Формируем результат в формате MiniApp
      const searchResults = {
        query: {
          destination,
          startDate,
          endDate: searchParams.endDate.toISOString(),
          adults,
          children,
          childrenAges
        },
        results: tourCards,
        totalCount: tourCards.length,
        filters: {
          // Собираем доступные фильтры из результатов
          priceRange: {
            min: Math.min(...tourCards.map(card => card.priceRange.min)),
            max: Math.max(...tourCards.map(card => card.priceRange.max))
          },
          stars: [...new Set(tourCards.map(card => card.hotel.stars))].sort(),
          meals: [...new Set(tourCards.flatMap(card => 
            card.options.map(opt => opt.meal.code)
          ))],
          providers: [...new Set(tourCards.flatMap(card => 
            card.options.map(opt => opt.provider)
          ))]
        },
        sorting: {
          current: 'match',
          available: ['price', 'rating', 'popularity', 'match']
        },
        pagination: {
          page: 1,
          pageSize: 20,
          totalPages: Math.ceil(tourCards.length / 20)
        }
      };
      
      res.json(searchResults);
    } catch (error) {
      apiLogger.error('Error searching tours:', error);
      res.status(500).json({ 
        error: "Ошибка при поиске туров",
        message: error instanceof Error ? error.message : "Неизвестная ошибка"
      });
    }
  });
}

function sortTours(list: any[], sortBy: string): any[] {
  const arr = list.slice();
  switch (sortBy) {
    case 'price':
      arr.sort((a: any, b: any) => (a.price ?? 0) - (b.price ?? 0));
      break;
    case 'stars':
      arr.sort((a: any, b: any) => (b.hotelStars ?? 0) - (a.hotelStars ?? 0));
      break;
    case 'rating':
      arr.sort((a: any, b: any) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case 'match':
    default:
      arr.sort((a: any, b: any) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }
  return arr;
}