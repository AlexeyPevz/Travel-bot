import request from 'supertest';
import express from 'express';
import { registerRoutes } from '../../server/routes';

describe('Health Check API', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = express();
    await registerRoutes(app);
  });

  describe('GET /api/health', () => {
    it('should return 200 OK with status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should not be rate limited', async () => {
      // Make multiple requests quickly
      const requests = Array(10).fill(null).map(() => 
        request(app).get('/api/health')
      );

      const responses = await Promise.all(requests);
      
      // All should be successful
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});