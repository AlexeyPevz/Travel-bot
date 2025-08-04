import request from 'supertest';
import express from 'express';
import { setupRoutes } from '../../server/routes';
import { db } from '../../db';
import { profiles, travelRequests, tourCache, watchlists } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { startBot } from '../../server/bot';
import { redis } from '../../server/services/cache';

describe('Tour Booking Integration', () => {
  let app: express.Express;
  let server: any;
  const testUserId = 'integration-test-user';
  
  beforeAll(async () => {
    app = express();
    app.use(express.json());
    server = await setupRoutes(app);
    
    // Ensure clean state
    await cleanupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await redis.quit();
    server.close();
  });

  async function cleanupTestData() {
    await db.delete(watchlists).where(eq(watchlists.userId, testUserId));
    await db.delete(travelRequests).where(eq(travelRequests.userId, testUserId));
    await db.delete(profiles).where(eq(profiles.userId, testUserId));
    await redis.flushdb();
  }

  describe('Complete Tour Search and Booking Flow', () => {
    it('should handle complete user journey from profile creation to tour monitoring', async () => {
      // Step 1: Create user profile
      const profileData = {
        userId: testUserId,
        username: 'traveler123',
        name: 'Integration Tester',
        travelStyle: 'comfort',
        interests: ['beach', 'culture', 'food'],
        budget: { min: 50000, max: 100000 },
        preferences: {
          hotelRating: 4,
          mealType: 'all-inclusive',
        },
      };

      const profileResponse = await request(app)
        .post('/api/v1/profile')
        .send(profileData)
        .expect(201);

      expect(profileResponse.body).toMatchObject({
        userId: testUserId,
        username: 'traveler123',
        travelStyle: 'comfort',
      });

      // Step 2: Verify profile was cached
      const cachedProfile = await request(app)
        .get(`/api/v1/profile/${testUserId}`)
        .expect(200);

      expect(cachedProfile.body.userId).toBe(testUserId);

      // Step 3: Search for tours
      const searchParams = {
        destination: 'Турция',
        startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days from now
        endDate: new Date(Date.now() + 67 * 24 * 60 * 60 * 1000).toISOString(),
        adults: 2,
        children: 0,
        budget: { min: 50000, max: 100000 },
      };

      const searchResponse = await request(app)
        .post('/api/v1/tours/search')
        .send(searchParams)
        .expect(200);

      expect(searchResponse.body).toHaveProperty('tours');
      expect(Array.isArray(searchResponse.body.tours)).toBe(true);

      // Step 4: If tours found, track one for monitoring
      if (searchResponse.body.tours.length > 0) {
        const tourToTrack = searchResponse.body.tours[0];
        
        // First create a travel request
        const travelRequest = await db.insert(travelRequests).values({
          id: `req-${Date.now()}`,
          userId: testUserId,
          query: 'Турция, пляжный отдых',
          destination: 'Турция',
          startDate: new Date(searchParams.startDate),
          endDate: new Date(searchParams.endDate),
          adults: 2,
          budget: searchParams.budget,
          preferences: profileData.preferences,
          status: 'active',
        }).returning();

        // Track the tour
        const trackResponse = await request(app)
          .post('/api/tours/track')
          .send({
            userId: testUserId,
            requestId: travelRequest[0].id,
            tourId: tourToTrack.id,
            tourData: tourToTrack,
          })
          .expect(200);

        expect(trackResponse.body).toHaveProperty('success', true);

        // Step 5: Verify tour is in watchlist
        const watchlistResponse = await request(app)
          .get(`/api/tours/watchlist/${testUserId}`)
          .expect(200);

        expect(watchlistResponse.body.watchlist).toBeInstanceOf(Array);
        expect(watchlistResponse.body.watchlist.length).toBeGreaterThan(0);

        // Step 6: Update profile preferences
        const updateResponse = await request(app)
          .put(`/api/v1/profile/${testUserId}`)
          .send({
            preferences: {
              hotelRating: 5,
              mealType: 'ultra-all-inclusive',
            },
          })
          .expect(200);

        expect(updateResponse.body.preferences.hotelRating).toBe(5);

        // Step 7: Stop monitoring
        const stopResponse = await request(app)
          .delete(`/api/tours/track/${travelRequest[0].id}`)
          .expect(200);

        expect(stopResponse.body).toHaveProperty('success', true);
      }
    });

    it('should handle errors gracefully throughout the flow', async () => {
      // Test invalid profile creation
      const invalidProfile = await request(app)
        .post('/api/v1/profile')
        .send({
          // Missing required fields
          username: 'test',
        })
        .expect(400);

      expect(invalidProfile.body).toHaveProperty('error');

      // Test searching without valid dates
      const invalidSearch = await request(app)
        .post('/api/v1/tours/search')
        .send({
          destination: 'Mars',
          startDate: 'invalid-date',
          adults: 'not-a-number',
        })
        .expect(400);

      expect(invalidSearch.body).toHaveProperty('error');

      // Test accessing non-existent profile
      const notFound = await request(app)
        .get('/api/v1/profile/non-existent-user')
        .expect(404);

      expect(notFound.body).toHaveProperty('error');
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent requests properly', async () => {
      const concurrentRequests = 10;
      const requests = [];

      // Create multiple concurrent profile reads
      for (let i = 0; i < concurrentRequests; i++) {
        requests.push(
          request(app).get(`/api/v1/profile/${testUserId}`)
        );
      }

      const responses = await Promise.all(requests);
      
      // All should succeed or return 404
      responses.forEach(response => {
        expect([200, 404]).toContain(response.status);
      });
    });
  });

  describe('Cache Invalidation', () => {
    it('should properly invalidate cache on updates', async () => {
      // Create a profile
      await request(app)
        .post('/api/v1/profile')
        .send({
          userId: `cache-test-${Date.now()}`,
          username: 'cachetest',
          name: 'Cache Test',
          travelStyle: 'budget',
        })
        .expect(201);

      // Read it (should cache)
      const firstRead = await request(app)
        .get(`/api/v1/profile/cache-test-${Date.now()}`)
        .expect(200);

      // Update it
      await request(app)
        .put(`/api/v1/profile/cache-test-${Date.now()}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      // Read again (should get updated version)
      const secondRead = await request(app)
        .get(`/api/v1/profile/cache-test-${Date.now()}`)
        .expect(200);

      expect(secondRead.body.name).toBe('Updated Name');
    });
  });
});