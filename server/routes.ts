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

// New modular routers
import legacyRoutes from './routes/legacy';
import groupRoutes from './routes/group';
import watchlistRoutes from './routes/watchlist';
import analyzeRoutes from './routes/analyze';
import telegramRoutes from './routes/telegram';
import healthRoutes from './routes/health';

export async function registerRoutes(app: Express, httpServer?: Server): Promise<void> {
  // Bot startup (non-blocking)
  const disableBot = process.env.DISABLE_BOT === 'true';
  if (!disableBot && httpServer) {
    (async () => {
      try { await startBot(httpServer); } catch (err) { apiLogger.error('Bot startup failed, continuing without bot:', err as any); }
    })();
  }
  // Monitoring startup (non-blocking)
  (async () => { try { startMonitoring(); } catch (err) { apiLogger.error('Monitoring startup failed:', err as any); } })();

  // API versioning middleware
  app.use('/api', apiVersionMiddleware);

  // Modular routes
  app.use('/api', telegramRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api', healthRoutes);
  app.use('/api', analyzeRoutes);
  app.use('/api', legacyRoutes);
  app.use('/api/group', groupRoutes);
  app.use('/api/watchlist', watchlistRoutes);

  // Versioned
  app.use('/api/v1', v1Routes);
  app.use('/api/v2', v2Routes);

  // Swagger
  setupSwagger(app);

  // Redirect legacy
  app.get('/api/profile/:userId', (req, res) => { res.redirect(301, `/api/v1/profile/${req.params.userId}`); });

  // Create or update profile
  app.post('/api/profile', 
    requireAuth,
    validateBody(createProfileSchema),
    authorizeOwner('userId'),
    asyncHandler(async (req: Request, res: Response) => {
      const profileData = req.body;
      const { userId, priorities, ...rest } = profileData;

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

      await cache.del(cacheKeys.profile(userId));
      await cache.clearPattern('tours:search:*');
      res.json(profile);
    }));

  // MiniApp enriched tours search remains here (non-versioned POST)
  app.post("/api/tours/search", async (req: Request, res: Response) => {
    const { 
      destination, startDate, endDate, adults = 2, children = 0, childrenAges = [], departureCity = 'Москва', nights, budget, mealType, hotelStars, searchId, userId
    } = req.body;
    if (!destination || !startDate || !nights) {
      return res.status(400).json({ 
        error: "Необходимо указать направление, дату начала и количество ночей" 
      });
    }
    try {
      const searchParams = {
        destination,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : new Date(new Date(startDate).getTime() + nights * 24 * 60 * 60 * 1000),
        adults, children, childrenAges, departureCity, nights, budget, mealType, hotelStars
      };
      const tours = await fetchToursFromAllProviders(searchParams);
      const { hotelDeduplicationService } = await import('./services/hotelDeduplication');
      const tourCards = hotelDeduplicationService.groupToursByHotel(tours);
      const searchResults = {
        query: { destination, startDate, endDate: (searchParams as any).endDate.toISOString(), adults, children, childrenAges },
        results: tourCards,
        totalCount: tourCards.length,
        filters: {
          priceRange: { min: Math.min(...tourCards.map(card => card.priceRange.min)), max: Math.max(...tourCards.map(card => card.priceRange.max)) },
          stars: [...new Set(tourCards.map(card => card.hotel.stars))].sort(),
          meals: [...new Set(tourCards.flatMap(card => card.options.map(opt => opt.meal.code)))],
          providers: [...new Set(tourCards.flatMap(card => card.options.map(opt => opt.provider)))]
        },
        sorting: { current: 'match', available: ['price', 'rating', 'popularity', 'match'] },
        pagination: { page: 1, pageSize: 20, totalPages: Math.ceil(tourCards.length / 20) }
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

// Legacy local util is removed; shared util is used in the modular route.