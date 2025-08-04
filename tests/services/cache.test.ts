import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { cacheService, CACHE_KEYS, CACHE_TTL } from '../../server/services/cache';
import { getRedisClient } from '../../server/config/redis';
import logger from '../../server/utils/logger';

// Mock dependencies
jest.mock('../../server/config/redis');
jest.mock('../../server/utils/logger');

describe('Cache Service', () => {
  let mockRedisClient: any;

  beforeEach(() => {
    mockRedisClient = {
      get: jest.fn(),
      set: jest.fn(),
      setex: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      keys: jest.fn(),
      pipeline: jest.fn()
    };

    (getRedisClient as jest.Mock).mockReturnValue(mockRedisClient);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('get', () => {
    it('should return parsed JSON value from cache', async () => {
      const testData = { foo: 'bar', count: 42 };
      mockRedisClient.get.mockResolvedValue(JSON.stringify(testData));

      const result = await cacheService.get('test-key');

      expect(result).toEqual(testData);
      expect(mockRedisClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return null for non-existent key', async () => {
      mockRedisClient.get.mockResolvedValue(null);

      const result = await cacheService.get('non-existent');

      expect(result).toBeNull();
    });

    it('should return raw string for non-JSON values', async () => {
      const testString = 'not-json';
      mockRedisClient.get.mockResolvedValue(testString);

      const result = await cacheService.get('test-key');

      expect(result).toBe(testString);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.get('test-key');

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalledWith('Cache get error:', expect.any(Error));
    });
  });

  describe('set', () => {
    it('should set JSON value with TTL', async () => {
      const testData = { foo: 'bar' };
      const ttl = 3600;

      await cacheService.set('test-key', testData, ttl);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-key',
        ttl,
        JSON.stringify(testData)
      );
    });

    it('should set string value with TTL', async () => {
      const testString = 'simple-string';
      const ttl = 3600;

      await cacheService.set('test-key', testString, ttl);

      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        'test-key',
        ttl,
        testString
      );
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.setex.mockRejectedValue(new Error('Redis error'));

      await cacheService.set('test-key', 'value', 3600);

      expect(logger.error).toHaveBeenCalledWith('Cache set error:', expect.any(Error));
    });
  });

  describe('delete', () => {
    it('should delete single key', async () => {
      mockRedisClient.del.mockResolvedValue(1);

      await cacheService.delete('test-key');

      expect(mockRedisClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should delete multiple keys', async () => {
      const keys = ['key1', 'key2', 'key3'];
      mockRedisClient.del.mockResolvedValue(3);

      await cacheService.delete(keys);

      expect(mockRedisClient.del).toHaveBeenCalledWith(...keys);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.del.mockRejectedValue(new Error('Redis error'));

      await cacheService.delete('test-key');

      expect(logger.error).toHaveBeenCalledWith('Cache delete error:', expect.any(Error));
    });
  });

  describe('exists', () => {
    it('should return true if key exists', async () => {
      mockRedisClient.exists.mockResolvedValue(1);

      const result = await cacheService.exists('test-key');

      expect(result).toBe(true);
      expect(mockRedisClient.exists).toHaveBeenCalledWith('test-key');
    });

    it('should return false if key does not exist', async () => {
      mockRedisClient.exists.mockResolvedValue(0);

      const result = await cacheService.exists('test-key');

      expect(result).toBe(false);
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.exists.mockRejectedValue(new Error('Redis error'));

      const result = await cacheService.exists('test-key');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith('Cache exists error:', expect.any(Error));
    });
  });

  describe('clearPattern', () => {
    it('should delete all keys matching pattern', async () => {
      const matchingKeys = ['user:123', 'user:456', 'user:789'];
      mockRedisClient.keys.mockResolvedValue(matchingKeys);
      mockRedisClient.del.mockResolvedValue(3);

      await cacheService.clearPattern('user:*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('user:*');
      expect(mockRedisClient.del).toHaveBeenCalledWith(...matchingKeys);
    });

    it('should handle no matching keys', async () => {
      mockRedisClient.keys.mockResolvedValue([]);

      await cacheService.clearPattern('nonexistent:*');

      expect(mockRedisClient.keys).toHaveBeenCalledWith('nonexistent:*');
      expect(mockRedisClient.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.keys.mockRejectedValue(new Error('Redis error'));

      await cacheService.clearPattern('test:*');

      expect(logger.error).toHaveBeenCalledWith('Cache clear pattern error:', expect.any(Error));
    });
  });

  describe('getMultiple', () => {
    it('should return multiple values', async () => {
      const keys = ['key1', 'key2', 'key3'];
      const values = ['{"a":1}', null, 'string-value'];
      
      const pipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(values.map(v => [null, v]))
      };
      
      mockRedisClient.pipeline.mockReturnValue(pipeline);

      const result = await cacheService.getMultiple(keys);

      expect(result).toEqual({
        key1: { a: 1 },
        key2: null,
        key3: 'string-value'
      });
      
      expect(pipeline.get).toHaveBeenCalledTimes(3);
      expect(pipeline.exec).toHaveBeenCalledTimes(1);
    });

    it('should handle pipeline errors', async () => {
      const pipeline = {
        get: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Pipeline error'))
      };
      
      mockRedisClient.pipeline.mockReturnValue(pipeline);

      const result = await cacheService.getMultiple(['key1', 'key2']);

      expect(result).toEqual({});
      expect(logger.error).toHaveBeenCalledWith('Cache getMultiple error:', expect.any(Error));
    });
  });

  describe('Cache Key Generators', () => {
    it('should generate correct cache keys', () => {
      expect(CACHE_KEYS.USER_PROFILE('123')).toBe('user:profile:123');
      expect(CACHE_KEYS.TOUR_SEARCH('abc-123')).toBe('tours:search:abc-123');
      expect(CACHE_KEYS.AI_ANALYSIS('request-456')).toBe('ai:analysis:request-456');
      expect(CACHE_KEYS.GROUP_PROFILE('group-789')).toBe('group:profile:group-789');
      expect(CACHE_KEYS.RECOMMENDED_TOURS('user-999')).toBe('tours:recommended:user-999');
    });
  });

  describe('Cache TTL Constants', () => {
    it('should have reasonable TTL values', () => {
      expect(CACHE_TTL.USER_PROFILE).toBe(300); // 5 minutes
      expect(CACHE_TTL.TOUR_SEARCH).toBe(600); // 10 minutes
      expect(CACHE_TTL.AI_ANALYSIS).toBe(604800); // 7 days
      expect(CACHE_TTL.GROUP_PROFILE).toBe(3600); // 1 hour
      expect(CACHE_TTL.RECOMMENDED_TOURS).toBe(900); // 15 minutes
      expect(CACHE_TTL.REFRESH_TOKEN).toBe(604800); // 7 days
    });
  });
});