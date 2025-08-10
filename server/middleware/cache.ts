import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../services/cache';
import { createHash } from 'crypto';
import logger from '../utils/logger';

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  invalidateOn?: string[]; // HTTP methods that invalidate cache
}

/**
 * Cache middleware factory
 * @param options Cache configuration options
 */
export function cache(options: CacheOptions = {}) {
  const {
    ttl = 300, // 5 minutes default
    key = defaultKeyGenerator,
    condition = () => true,
    invalidateOn = ['POST', 'PUT', 'PATCH', 'DELETE']
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching if condition not met
    if (!condition(req)) {
      return next();
    }

    // Invalidate cache on mutating operations
    if (invalidateOn.includes(req.method)) {
      const pattern = `cache:${req.baseUrl || req.path}:*`;
      try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) {
          await redisClient.del(...keys);
          logger.debug(`Cache invalidated for pattern: ${pattern}`);
        }
      } catch (error) {
        logger.error('Cache invalidation error:', error);
      }
      return next();
    }

    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = key(req);
    
    try {
      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        logger.debug(`Cache hit: ${cacheKey}`);
        
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-TTL', ttl.toString());
        
        return res.status(data.status || 200).json(data.body);
      }
    } catch (error) {
      logger.error('Cache retrieval error:', error);
      // Continue without cache
    }

    // Store original json method
    const originalJson = res.json.bind(res);
    let responseData: any;

    // Override json method to capture response
    res.json = function(body: any) {
      responseData = {
        status: res.statusCode,
        body,
        timestamp: Date.now()
      };

      // Store in cache if successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisClient.setex(cacheKey, ttl, JSON.stringify(responseData))
          .catch(error => logger.error('Cache storage error:', error));
      }

      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-TTL', ttl.toString());

      return originalJson(body);
    };

    next();
  };
}

/**
 * Default cache key generator
 */
function defaultKeyGenerator(req: Request): string {
  const hash = createHash('md5');
  
  // Include important request properties
  hash.update(req.method);
  hash.update(req.originalUrl || req.url);
  hash.update(JSON.stringify(req.query));
  hash.update(req.get('accept-language') || '');
  
  // Include user ID if authenticated
  const userId = (req as any).user?.id || 'anonymous';
  hash.update(userId);

  return `cache:${req.baseUrl || req.path}:${hash.digest('hex')}`;
}

/**
 * Cache configurations for specific routes
 */
export const cacheConfigs = {
  // Cache tour search results for 5 minutes
  tourSearch: cache({
    ttl: 300,
    condition: (req) => !req.query.nocache
  }),

  // Cache profile data for 10 minutes
  profile: cache({
    ttl: 600,
    key: (req) => `cache:profile:${req.params.userId}`,
    invalidateOn: ['POST', 'PUT', 'PATCH', 'DELETE']
  }),

  // Cache reference data for 1 hour
  references: cache({
    ttl: 3600
  }),

  // Cache hotel info for 30 minutes
  hotelInfo: cache({
    ttl: 1800,
    key: (req) => `cache:hotel:${req.params.hotelId}`
  }),

  // Short cache for health checks
  health: cache({
    ttl: 10
  })
};

/**
 * Clear all cache
 */
export async function clearCache(): Promise<void> {
  try {
    const keys = await redisClient.keys('cache:*');
    if (keys.length > 0) {
      await redisClient.del(...keys);
      logger.info(`Cleared ${keys.length} cache entries`);
    }
  } catch (error) {
    logger.error('Clear cache error:', error);
    throw error;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalKeys: number;
  memoryUsage: string;
  patterns: Record<string, number>;
}> {
  try {
    const keys = await redisClient.keys('cache:*');
    const info = await redisClient.info('memory');
    
    // Count keys by pattern
    const patterns: Record<string, number> = {};
    keys.forEach(key => {
      const pattern = key.split(':')[1] || 'unknown';
      patterns[pattern] = (patterns[pattern] || 0) + 1;
    });

    // Extract memory usage
    const memoryMatch = info.match(/used_memory_human:(\S+)/);
    const memoryUsage = memoryMatch ? memoryMatch[1] : 'unknown';

    return {
      totalKeys: keys.length,
      memoryUsage,
      patterns
    };
  } catch (error) {
    logger.error('Get cache stats error:', error);
    throw error;
  }
}