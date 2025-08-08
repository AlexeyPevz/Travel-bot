import express from 'express';
import request from 'supertest';
import v1 from '../../server/routes/v1';

// Mock providers search to avoid external calls
jest.mock('../../server/providers', () => ({
  searchTours: jest.fn(async () => [
    { title: 'Hotel A', country: 'Турция', price: 120000, starRating: 5, beachLine: 1, mealType: 'AI' },
    { title: 'Hotel B', country: 'Египет', price: 90000, starRating: 4, beachLine: 2, mealType: 'HB' },
  ])
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1', v1);
  return app;
}

describe('POST /api/v1/tours/search', () => {
  it('validates body and returns tours array', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/v1/tours/search')
      .send({ countries: ['Турция'], budget: 150000, peopleCount: 2, limit: 10, offset: 0 })
      .expect(200);

    expect(Array.isArray(res.body.tours)).toBe(true);
    expect(res.body.tours.length).toBeGreaterThan(0);
    expect(res.body.tours[0]).toHaveProperty('title');
  });

  it('rejects invalid body', async () => {
    const app = makeApp();
    const res = await request(app)
      .post('/api/v1/tours/search')
      // invalid: countries must be array
      .send({ countries: 'Турция' })
      .expect(400);

    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details?.message || '').toMatch(/Validation failed/i);
  });
});