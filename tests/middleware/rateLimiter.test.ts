import { jest } from '@jest/globals';
import { Request, Response } from 'express';
import { 
  apiLimiter, 
  authLimiter, 
  searchLimiter, 
  aiLimiter,
  dynamicRateLimiter,
  resetRateLimit,
  getRateLimitStatus
} from '../../server/middleware/rateLimiter';

// Мокаем Redis
jest.mock('../../server/services/cache', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn()
  }
}));

// Мокаем express-rate-limit
jest.mock('express-rate-limit', () => {
  return jest.fn(() => {
    return jest.fn((req: Request, res: Response, next: Function) => {
      // Простая имитация rate limiting
      const key = req.ip || 'test-ip';
      const count = (global as any).rateLimitCounts[key] || 0;
      (global as any).rateLimitCounts[key] = count + 1;
      
      if (count >= 5) { // Тестовый лимит
        res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded'
        });
      } else {
        next();
      }
    });
  });
});

// Мокаем rate-limit-redis
jest.mock('rate-limit-redis', () => ({
  default: jest.fn().mockImplementation(() => ({
    increment: jest.fn(),
    decrement: jest.fn(),
    resetKey: jest.fn()
  }))
}));

// Мокаем логгер
jest.mock('../../server/utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Rate Limiter Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    // Сбрасываем счетчики
    (global as any).rateLimitCounts = {};
    
    mockReq = {
      ip: '127.0.0.1',
      path: '/api/test',
      headers: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('Dynamic Rate Limiter', () => {
    it('should apply auth limiter for auth routes', () => {
      mockReq.path = '/api/auth/login';
      
      dynamicRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      // Проверяем что был вызван middleware (через next или response)
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should apply AI limiter for analyze-request routes', () => {
      mockReq.path = '/api/analyze-request';
      
      dynamicRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should apply search limiter for tour search routes', () => {
      mockReq.path = '/api/tours/search';
      
      dynamicRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should apply webhook limiter for webhook routes', () => {
      mockReq.path = '/webhook/telegram';
      
      dynamicRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should apply general API limiter for other routes', () => {
      mockReq.path = '/api/profile';
      
      dynamicRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate Limit Exceeded', () => {
    it('should return 429 when rate limit is exceeded', () => {
      // Симулируем превышение лимита
      mockReq.ip = 'spam-ip';
      (global as any).rateLimitCounts['spam-ip'] = 10;
      
      dynamicRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests'
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Rate Limit Utils', () => {
    const { redis } = require('../../server/services/cache');

    it('should reset rate limit for a key', async () => {
      redis.del.mockResolvedValueOnce(1);
      
      await resetRateLimit('test-key');
      
      expect(redis.del).toHaveBeenCalledWith('rl:test-key');
    });

    it('should get rate limit status', async () => {
      redis.get.mockResolvedValueOnce('5');
      redis.ttl.mockResolvedValueOnce(300); // 5 минут
      
      const status = await getRateLimitStatus('test-key');
      
      expect(status).toEqual({
        count: 5,
        resetTime: expect.any(Date)
      });
      
      expect(redis.get).toHaveBeenCalledWith('rl:test-key');
      expect(redis.ttl).toHaveBeenCalledWith('rl:test-key');
    });

    it('should return null if no rate limit exists', async () => {
      redis.get.mockResolvedValueOnce(null);
      
      const status = await getRateLimitStatus('non-existent-key');
      
      expect(status).toBeNull();
    });
  });

  describe('Skip Conditions', () => {
    it('should skip rate limiting for health check endpoint', () => {
      mockReq.path = '/api/health';
      
      // Так как rate limiter пропускает health check, next должен быть вызван
      dynamicRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should skip rate limiting for metrics endpoint', () => {
      mockReq.path = '/metrics';
      
      dynamicRateLimiter(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});