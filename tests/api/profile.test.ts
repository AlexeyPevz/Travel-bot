import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';
import { db } from '../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('Profile API', () => {
  let app: express.Express;
  const testUserId = 'test-user-123';

  beforeAll(() => {
    app = express();
    app.use(express.json());
    setupRoutes(app);
  });

  beforeEach(async () => {
    // Clean up test data
    await db.delete(profiles).where(eq(profiles.userId, testUserId));
  });

  afterAll(async () => {
    // Final cleanup
    await db.delete(profiles).where(eq(profiles.userId, testUserId));
  });

  describe('GET /api/profile/:userId', () => {
    it('should return 404 for non-existent profile', async () => {
      const response = await request(app)
        .get(`/api/profile/${testUserId}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });

    it('should return profile when it exists', async () => {
      // Create test profile
      await db.insert(profiles).values({
        userId: testUserId,
        username: 'testuser',
        name: 'Test User',
        travelStyle: 'budget',
        interests: ['beach', 'culture'],
        budget: { min: 1000, max: 2000 },
        preferences: {},
      });

      const response = await request(app)
        .get(`/api/profile/${testUserId}`)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: testUserId,
        username: 'testuser',
        name: 'Test User',
        travelStyle: 'budget',
      });
    });
  });

  describe('POST /api/profile', () => {
    it('should create a new profile', async () => {
      const newProfile = {
        userId: testUserId,
        username: 'newuser',
        name: 'New User',
        travelStyle: 'luxury',
        interests: ['adventure', 'food'],
        budget: { min: 5000, max: 10000 },
      };

      const response = await request(app)
        .post('/api/profile')
        .send(newProfile)
        .expect(201);

      expect(response.body).toMatchObject({
        userId: testUserId,
        username: 'newuser',
        travelStyle: 'luxury',
      });

      // Verify in database
      const saved = await db.select().from(profiles).where(eq(profiles.userId, testUserId));
      expect(saved).toHaveLength(1);
    });

    it('should return 400 for invalid data', async () => {
      const invalidProfile = {
        userId: testUserId,
        // Missing required fields
      };

      const response = await request(app)
        .post('/api/profile')
        .send(invalidProfile)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 409 for duplicate profile', async () => {
      // Create initial profile
      await db.insert(profiles).values({
        userId: testUserId,
        username: 'existing',
        name: 'Existing User',
        travelStyle: 'budget',
        interests: [],
        budget: { min: 1000, max: 2000 },
        preferences: {},
      });

      // Try to create duplicate
      const response = await request(app)
        .post('/api/profile')
        .send({
          userId: testUserId,
          username: 'duplicate',
          name: 'Duplicate User',
          travelStyle: 'luxury',
        })
        .expect(409);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('PUT /api/profile/:userId', () => {
    beforeEach(async () => {
      // Create test profile for updates
      await db.insert(profiles).values({
        userId: testUserId,
        username: 'updateuser',
        name: 'Update User',
        travelStyle: 'budget',
        interests: ['beach'],
        budget: { min: 1000, max: 2000 },
        preferences: {},
      });
    });

    it('should update existing profile', async () => {
      const updates = {
        name: 'Updated Name',
        travelStyle: 'luxury',
        interests: ['adventure', 'culture', 'food'],
      };

      const response = await request(app)
        .put(`/api/profile/${testUserId}`)
        .send(updates)
        .expect(200);

      expect(response.body).toMatchObject({
        userId: testUserId,
        name: 'Updated Name',
        travelStyle: 'luxury',
      });
    });

    it('should return 404 for non-existent profile', async () => {
      const response = await request(app)
        .put('/api/profile/non-existent-user')
        .send({ name: 'Test' })
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit excessive requests', async () => {
      // Make many requests quickly
      const requests = Array(35).fill(null).map(() => 
        request(app).get(`/api/profile/${testUserId}`)
      );

      const responses = await Promise.all(requests);
      
      // Some should be rate limited
      const rateLimited = responses.filter(r => r.status === 429);
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });
});