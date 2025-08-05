import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../services/cache';
import { Request, Response } from 'express';
import logger from '../utils/logger';

/**
 * Создает сообщение об ошибке для превышения лимита
 */
const createRateLimitMessage = (windowMs: number, max: number) => {
  const minutes = Math.floor(windowMs / 60000);
  return {
    error: 'Too many requests',
    message: `Вы превысили лимит запросов. Максимум ${max} запросов за ${minutes} минут.`,
    retryAfter: windowMs / 1000
  };
};

/**
 * Обработчик превышения лимита
 */
const rateLimitHandler = (req: Request, res: Response, windowMs: number, max: number) => {
  logger.warn(`Rate limit exceeded for IP: ${req.ip}, Path: ${req.path}`);
  res.status(429).json(createRateLimitMessage(windowMs, max));
};

/**
 * Базовая конфигурация rate limiter
 */
const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}) => {
  const { windowMs, max, skipSuccessfulRequests = false, keyGenerator } = options;

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true, // Возвращает rate limit info в `RateLimit-*` headers
    legacyHeaders: false, // Отключает `X-RateLimit-*` headers
    skipSuccessfulRequests,
    handler: (req, res) => rateLimitHandler(req, res, windowMs, max),
    keyGenerator: keyGenerator || ((req) => {
      // Используем IP адрес или user ID из JWT (когда будет реализован)
      const userId = (req as any).user?.id;
      return userId ? `user:${userId}` : `ip:${req.ip}`;
    }),
    store: new RedisStore({
      client: redis,
      prefix: 'rl:',
      sendCommand: (...args: string[]) => (redis as any).call(...args),
    }),
    skip: (req) => {
      // Пропускаем rate limiting для health check и метрик
      return req.path === '/api/health' || req.path === '/metrics';
    }
  });
};

/**
 * Rate limiter для общих API запросов
 * 100 запросов за 15 минут на IP/пользователя
 */
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100
});

/**
 * Строгий rate limiter для аутентификации
 * 5 попыток за 15 минут на IP
 */
export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5,
  skipSuccessfulRequests: true, // Не считаем успешные попытки
  keyGenerator: (req) => `auth:${req.ip}` // Только по IP для auth
});

/**
 * Rate limiter для поиска туров
 * 30 запросов за 5 минут на пользователя
 */
export const searchLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 30
});

/**
 * Rate limiter для AI анализа
 * 10 запросов за 5 минут на пользователя (AI дорогой ресурс)
 */
export const aiLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 10,
  keyGenerator: (req) => {
    // Для AI используем комбинацию user ID и IP
    const userId = (req as any).user?.id;
    return userId ? `ai:user:${userId}` : `ai:ip:${req.ip}`;
  }
});

/**
 * Rate limiter для webhook endpoints
 * 1000 запросов за 1 минуту (для Telegram updates)
 */
export const webhookLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 минута
  max: 1000,
  keyGenerator: (req) => `webhook:${req.path}`
});

/**
 * Динамический rate limiter на основе пути
 */
export const dynamicRateLimiter = (req: Request, res: Response, next: Function) => {
  const path = req.path;

  // Выбираем подходящий limiter на основе пути
  if (path.startsWith('/api/auth')) {
    return authLimiter(req, res, next);
  } else if (path.includes('/analyze-request')) {
    return aiLimiter(req, res, next);
  } else if (path.includes('/tours') || path.includes('/search')) {
    return searchLimiter(req, res, next);
  } else if (path.startsWith('/webhook')) {
    return webhookLimiter(req, res, next);
  } else {
    return apiLimiter(req, res, next);
  }
};

/**
 * Создает rate limiter для конкретного пользователя с кастомными лимитами
 * (может использоваться для VIP пользователей или партнеров)
 */
export const createUserRateLimiter = (userId: string, options: {
  windowMs: number;
  max: number;
}) => {
  return createRateLimiter({
    ...options,
    keyGenerator: () => `custom:user:${userId}`
  });
};

/**
 * Сбрасывает rate limit для конкретного ключа
 */
export const resetRateLimit = async (key: string): Promise<void> => {
  try {
    await redis.del(`rl:${key}`);
    logger.info(`Rate limit reset for key: ${key}`);
  } catch (error) {
    logger.error('Error resetting rate limit:', error);
  }
};

/**
 * Получает текущий статус rate limit для ключа
 */
export const getRateLimitStatus = async (key: string): Promise<{
  count: number;
  resetTime: Date;
} | null> => {
  try {
    const count = await redis.get(`rl:${key}`);
    const ttl = await redis.ttl(`rl:${key}`);
    
    if (!count || ttl < 0) {
      return null;
    }

    return {
      count: parseInt(count),
      resetTime: new Date(Date.now() + ttl * 1000)
    };
  } catch (error) {
    logger.error('Error getting rate limit status:', error);
    return null;
  }
};