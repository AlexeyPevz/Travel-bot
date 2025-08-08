import cache, { CACHE_KEYS, CACHE_TTL } from '../../server/services/cache';

describe('Cache service', () => {
  it('sets and gets values with TTL', async () => {
    const key = `test:key:${Date.now()}`;
    const value = { hello: 'world' };
    await cache.set(key, value as any, 1);
    const got = await cache.get(key);
    expect(got).toEqual(value);
  });

  it('CACHE_KEYS produces expected patterns', () => {
    expect(CACHE_KEYS.profile('u1')).toBe('profile:u1');
    expect(CACHE_KEYS.tourSearch({ c: ['RU'] })).toMatch(/^tours:search:/);
    expect(CACHE_KEYS.aiAnalysis('msg')).toMatch(/^ai:analysis:/);
  });

  it('CACHE_TTL has sane values', () => {
    expect(CACHE_TTL.PROFILE).toBeGreaterThan(0);
    expect(CACHE_TTL.AI_ANALYSIS).toBeGreaterThan(CACHE_TTL.PROFILE);
  });
});