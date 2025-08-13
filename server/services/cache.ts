import Redis from 'ioredis';
import logger from '../utils/logger';

// Инициализация Redis клиента
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  enableOfflineQueue: true,
  maxRetriesPerRequest: 3
});

// Обработка событий Redis
redis.on('connect', () => {
  logger.info('Redis connected successfully');
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

redis.on('ready', () => {
  logger.info('Redis ready to accept commands');
});

// TTL константы (в секундах)
export const CACHE_TTL = {
  PROFILE: 60 * 60, // 1 час
  TOUR_SEARCH: 30 * 60, // 30 минут
  TOUR_DETAILS: 60 * 60 * 24, // 24 часа
  AI_ANALYSIS: 60 * 60 * 24 * 7, // 7 дней
  GROUP_PROFILE: 60 * 60, // 1 час
  RECOMMENDED_TOURS: 15 * 60, // 15 минут
  REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7 дней
};

// Генерация ключей кэша
export const cacheKeys = {
  profile: (userId: string) => `profile:${userId}`,
  tourSearch: (params: any) => `tours:search:${JSON.stringify(params)}`,
  tourDetails: (tourId: number) => `tours:details:${tourId}`,
  aiAnalysis: (message: string) => `ai:analysis:${Buffer.from(message).toString('base64')}`,
  groupProfile: (chatId: string) => `group:profile:${chatId}`,
  recommendedTours: (userId: string) => `tours:recommended:${userId}`,
  userPriorities: (userId: string) => `priorities:${userId}`,
};

// Основные функции кэша
export const cache = {
  // Получить значение из кэша
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await redis.get(key);
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  },

  // Сохранить значение в кэш
  async set<T>(key: string, value: T, ttl?: number): Promise<'OK'> {
    try {
      const serialized = JSON.stringify(value);
      
      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
      
      logger.debug(`Cached ${key} with TTL ${ttl || 'infinite'}`);
      return 'OK';
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      throw error;
    }
  },

  // Удалить значение из кэша
  async del(key: string | string[]): Promise<number> {
    try {
      if (Array.isArray(key)) {
        return await redis.del(...key);
      } else {
        return await redis.del(key);
      }
      
      logger.debug(`Deleted cache key(s): ${key}`);
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      throw error;
    }
  },

  // Очистить кэш по паттерну
  async clearPattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info(`Cleared ${keys.length} cache keys matching pattern: ${pattern}`);
      }
    } catch (error) {
      logger.error(`Cache clear pattern error for ${pattern}:`, error);
    }
  },

  // Проверить существование ключа
  async exists(key: string): Promise<boolean> {
    try {
      return (await redis.exists(key)) === 1;
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  },

  // Установить TTL для существующего ключа
  async expire(key: string, ttl: number): Promise<void> {
    try {
      await redis.expire(key, ttl);
    } catch (error) {
      logger.error(`Cache expire error for key ${key}:`, error);
    }
  },

  // Получить оставшееся время жизни ключа
  async ttl(key: string): Promise<number> {
    try {
      return await redis.ttl(key);
    } catch (error) {
      logger.error(`Cache TTL error for key ${key}:`, error);
      return -1;
    }
  },

  // Инкремент значения
  async incr(key: string): Promise<number> {
    try {
      return await redis.incr(key);
    } catch (error) {
      logger.error(`Cache incr error for key ${key}:`, error);
      return 0;
    }
  },

  // Декремент значения
  async decr(key: string): Promise<number> {
    try {
      return await redis.decr(key);
    } catch (error) {
      logger.error(`Cache decr error for key ${key}:`, error);
      return 0;
    }
  }
};

// Декоратор для кэширования результатов функций
export function cached(keyGenerator: (...args: any[]) => string, ttl: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = keyGenerator(...args);
      
      // Пытаемся получить из кэша
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult !== null) {
        logger.debug(`Cache hit for ${propertyKey} with key ${cacheKey}`);
        return cachedResult;
      }

      // Если нет в кэше, выполняем оригинальный метод
      logger.debug(`Cache miss for ${propertyKey} with key ${cacheKey}`);
      const result = await originalMethod.apply(this, args);
      
      // Сохраняем результат в кэш
      await cache.set(cacheKey, result, ttl);
      
      return result;
    };

    return descriptor;
  };
}

// Функция для очистки устаревшего кэша
export async function cleanupCache() {
  try {
    // Очищаем старые поиски туров (старше 24 часов)
    await cache.clearPattern('tours:search:*');
    
    // Очищаем старые AI анализы (старше 30 дней)
    await cache.clearPattern('ai:analysis:*');
    
    logger.info('Cache cleanup completed');
  } catch (error) {
    logger.error('Cache cleanup error:', error);
  }
}

// Запускаем очистку кэша каждые 24 часа
setInterval(cleanupCache, 24 * 60 * 60 * 1000);

export { cacheKeys as CACHE_KEYS };
export { redis };
export default cache;