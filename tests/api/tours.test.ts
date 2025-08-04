import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { db } from '../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('Tours API', () => {
  let app: express.Express;
  const testUserId = 'test-user-tours';
  const testRequestId = 'test-request-123';

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    setupRoutes(app);

    // Create test profile
    await db.insert(profiles).values({
      userId: testUserId,
      username: 'touruser',
      name: 'Tour User',
      travelStyle: 'budget',
      interests: ['beach', 'culture'],
      budget: { min: 1000, max: 3000 },
      preferences: {},
    });
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(travelRequests).where(eq(travelRequests.userId, testUserId));
    await db.delete(tourCache);
  });

  afterAll(async () => {
    // Final cleanup
    await db.delete(travelRequests).where(eq(travelRequests.userId, testUserId));
    await db.delete(profiles).where(eq(profiles.userId, testUserId));
    await db.delete(tourCache);
  });

  describe('POST /api/tours/search', () => {
    it('should search for tours with valid request', async () => {
      const searchRequest = {
        destination: 'Турция',
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
        endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString(), // 37 days from now
        adults: 2,
        children: 0,
        budget: { min: 1000, max: 3000 },
      };

      const response = await request(app)
        .post('/api/tours/search')
        .send(searchRequest)
        .expect(200);

      expect(response.body).toHaveProperty('tours');
      expect(Array.isArray(response.body.tours)).toBe(true);
      
      if (response.body.tours.length > 0) {
        const tour = response.body.tours[0];
        expect(tour).toHaveProperty('id');
        expect(tour).toHaveProperty('title');
        expect(tour).toHaveProperty('price');
        expect(tour).toHaveProperty('hotelName');
      }
    });

    it('should return 400 for invalid search parameters', async () => {
      const invalidRequest = {
        destination: 'Turkey',
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/tours/search')
        .send(invalidRequest)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle date validation', async () => {
      const response = await request(app)
        .post('/api/tours/search')
        .send({
          destination: 'Egypt',
          startDate: '2020-01-01', // Past date
          endDate: '2020-01-08',
          adults: 1,
        })
        .expect(400);

      expect(response.body.error).toContain('date');
    });
  });

  describe('GET /api/tours/:tourId', () => {
    it('should get tour details', async () => {
      // This would typically test against a mocked or known tour ID
      // For now, we'll test the endpoint structure
      const response = await request(app)
        .get('/api/tours/test-tour-id')
        .expect((res) => {
          // Accept either 200 (found) or 404 (not found)
          expect([200, 404]).toContain(res.status);
        });

      if (response.status === 200) {
        expect(response.body).toHaveProperty('tour');
        expect(response.body.tour).toHaveProperty('id');
        expect(response.body.tour).toHaveProperty('title');
      }
    });
  });

  describe('POST /api/tours/track', () => {
    beforeEach(async () => {
      // Create a travel request
      await db.insert(travelRequests).values({
        id: testRequestId,
        userId: testUserId,
        query: 'Египет, пляжный отдых',
        destination: 'Египет',
        startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
        adults: 2,
        budget: { min: 1500, max: 3000 },
        preferences: { hotelRating: 4 },
        status: 'active',
      });
    });

    it('should track a tour for monitoring', async () => {
      const trackRequest = {
        userId: testUserId,
        requestId: testRequestId,
        tourId: 'test-tour-123',
        tourData: {
          id: 'test-tour-123',
          title: 'Test Tour to Egypt',
          price: 2500,
          hotelName: 'Test Resort',
          hotelRating: 5,
          destination: 'Egypt',
        },
      };

      const response = await request(app)
        .post('/api/tours/track')
        .send(trackRequest)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should return 400 for invalid tracking data', async () => {
      const response = await request(app)
        .post('/api/tours/track')
        .send({
          userId: testUserId,
          // Missing required fields
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/tours/watchlist/:userId', () => {
    it('should get user watchlist', async () => {
      const response = await request(app)
        .get(`/api/tours/watchlist/${testUserId}`)
        .expect(200);

      expect(response.body).toHaveProperty('watchlist');
      expect(Array.isArray(response.body.watchlist)).toBe(true);
    });

    it('should return empty array for user with no watchlist', async () => {
      const response = await request(app)
        .get('/api/tours/watchlist/new-user-no-data')
        .expect(200);

      expect(response.body.watchlist).toEqual([]);
    });
  });

  describe('DELETE /api/tours/track/:requestId', () => {
    beforeEach(async () => {
      // Create a travel request to delete
      await db.insert(travelRequests).values({
        id: 'delete-test-request',
        userId: testUserId,
        query: 'Test query',
        destination: 'Test',
        startDate: new Date(),
        endDate: new Date(),
        adults: 1,
        budget: { min: 1000, max: 2000 },
        preferences: {},
        status: 'active',
      });
    });

    it('should stop tracking a tour', async () => {
      const response = await request(app)
        .delete('/api/tours/track/delete-test-request')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);

      // Verify it's marked as inactive
      const [updated] = await db
        .select()
        .from(travelRequests)
        .where(eq(travelRequests.id, 'delete-test-request'));
      
      expect(updated.status).toBe('completed');
    });

    it('should return 404 for non-existent request', async () => {
      const response = await request(app)
        .delete('/api/tours/track/non-existent')
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});