import { Express } from 'express';
import { db } from '../db';
import { profiles, tours, tourMatches, groupProfiles, watchlists, tourPriorities } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { searchTours } from './providers';
import { analyzeTourRequest, calculateTourMatchScore } from './services/openrouter';
import { startBot } from './bot';
import { startMonitoring } from './services/monitoring';
import { createOrUpdateGroupProfile, aggregateGroupProfiles, handleGroupVote } from './services/groups';
import { Server } from 'http';
import { 
  validate, 
  validateQuery,
  updateProfileSchema,
  analyzeRequestSchema,
  tourSearchSchema,
  createGroupSchema,
  voteSchema,
  watchlistSchema
} from './validators/schemas';
import { asyncHandler, NotFoundError, ValidationError } from './utils/errors';
import apiLogger from '../utils/logger';
import { cache, cacheKeys, CACHE_TTL } from './services/cache';

export async function registerRoutes(app: Express): Promise<Server> {
  const server = require('http').createServer(app);

  // Запускаем бота
  const bot = await startBot(server);
  
  // Запускаем мониторинг
  startMonitoring();

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  // Получить профиль пользователя
  app.get('/api/profile/:userId', asyncHandler(async (req: any, res: any) => {
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
  app.post('/api/profile', validate(updateProfileSchema), async (req, res) => {
    try {
      const profileData = req.body;
      const { userId, priorities, ...rest } = profileData;

      if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
      }

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

      res.json(profile);
    } catch (error) {
      apiLogger.error('Error saving profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Анализ текстового запроса
  app.post('/api/analyze-request', validate(analyzeRequestSchema), async (req, res) => {
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
  });

  // Поиск туров
  app.get('/api/tours', validateQuery(tourSearchSchema), async (req, res) => {
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
            tours.map(async (tour) => {
              const { score, details, analysis } = await calculateTourMatchScore(
                tour,
                searchParams,
                profile.priorities as Record<string, number>
              );
              return { ...tour, matchScore: score, matchDetails: details, aiAnalysis: analysis };
            })
          );

          // Сортируем по соответствию
          toursWithScores.sort((a, b) => b.matchScore - a.matchScore);
          return res.json(toursWithScores);
        }
      }

      res.json(tours);
    } catch (error) {
      apiLogger.error('Error searching tours:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Создать watchlist
  app.post('/api/watchlist', async (req, res) => {
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
  });

  // Получить watchlists пользователя
  app.get('/api/watchlist/:userId', async (req, res) => {
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
  });

  // Групповые функции
  app.post('/api/group/create', async (req, res) => {
    try {
      const { chatId, chatTitle, memberIds } = req.body;

      if (!chatId || !memberIds) {
        return res.status(400).json({ error: 'chatId and memberIds are required' });
      }

      const groupId = await createOrUpdateGroupProfile(chatId, chatTitle, memberIds);
      await aggregateGroupProfiles(groupId);

      res.json({ groupId, message: 'Group profile created' });
    } catch (error) {
      apiLogger.error('Error creating group:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Голосование за тур
  app.post('/api/group/vote', async (req, res) => {
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
  });

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