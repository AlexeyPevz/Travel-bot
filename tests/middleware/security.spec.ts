import express from 'express';
import request from 'supertest';
import { setupSecurity } from '../../server/middleware/security';

function makeApp() {
  const app = express();
  setupSecurity(app);
  app.get('/ping', (_req, res) => res.json({ ok: true }));
  return app;
}

describe('security middleware', () => {
  it('sets security headers', async () => {
    const app = makeApp();
    const res = await request(app).get('/ping');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});