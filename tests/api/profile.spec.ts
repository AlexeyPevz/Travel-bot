import express from 'express';
import request from 'supertest';
import profileRouter from '../../server/routes/v1/profile';

// Mock auth middleware to simulate authenticated user
jest.mock('../../server/middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => { req.user = { userId: '123456' }; next(); },
  authorizeOwner: (_param: string) => (req: any, res: any, next: any) => {
    const requested = req.params.userId || req.body.userId || req.query.userId;
    if (requested !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    next();
  }
}));

// Mock DB
jest.mock('../../db', () => ({
  db: { select: jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue([{ userId: '123456', name: 'Test' }]) }) }) }
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  router.use('/profile', profileRouter);
  app.use('/api/v1', router);
  return app;
}

describe('GET /api/v1/profile/:userId', () => {
  it('returns 200 for owner', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/v1/profile/123456').expect(200);
    expect(res.body.userId).toBe('123456');
  });

  it('returns 403 for different user', async () => {
    const app = makeApp();
    const res = await request(app).get('/api/v1/profile/999').expect(403);
    expect(res.body.error).toBe('Forbidden');
  });
});