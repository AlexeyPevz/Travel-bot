import { jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { 
  validateBody, 
  validateQuery, 
  validateParams,
  validateAll,
  createValidatedHandler
} from '../../server/middleware/validation';

// Мокаем логгер
jest.mock('../../server/utils/logger', () => ({
  default: {
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('Validation Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      path: '/test',
      method: 'POST'
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('validateBody', () => {
    const testSchema = z.object({
      name: z.string().min(2),
      age: z.number().positive(),
      email: z.string().email()
    });

    it('should pass valid body data', async () => {
      mockReq.body = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      };

      const middleware = validateBody(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({
        name: 'John Doe',
        age: 30,
        email: 'john@example.com'
      });
      expect(mockReq.validated?.body).toEqual(mockReq.body);
    });

    it('should reject invalid body data', async () => {
      mockReq.body = {
        name: 'J', // too short
        age: -5, // negative
        email: 'not-an-email'
      };

      const middleware = validateBody(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: expect.objectContaining({
          message: expect.stringContaining('Validation failed'),
          errors: expect.arrayContaining([
            expect.objectContaining({
              path: 'name',
              message: expect.any(String)
            }),
            expect.objectContaining({
              path: 'age',
              message: expect.any(String)
            }),
            expect.objectContaining({
              path: 'email',
              message: expect.any(String)
            })
          ])
        })
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should strip extra fields by default', async () => {
      mockReq.body = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        extraField: 'should be removed'
      };

      const middleware = validateBody(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).not.toHaveProperty('extraField');
    });

    it('should use custom error formatter', async () => {
      mockReq.body = { name: 'J' };

      const customFormatter = jest.fn().mockReturnValue({ custom: 'error' });
      const middleware = validateBody(testSchema, {
        errorFormatter: customFormatter
      });
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(customFormatter).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Validation Error',
        details: { custom: 'error' }
      });
    });

    it('should use custom status code', async () => {
      mockReq.body = { name: 'J' };

      const middleware = validateBody(testSchema, {
        statusCode: 422
      });
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(422);
    });
  });

  describe('validateQuery', () => {
    const querySchema = z.object({
      page: z.number().positive(),
      limit: z.number().positive().max(100),
      sort: z.enum(['asc', 'desc']),
      filter: z.array(z.string()).optional()
    });

    it('should transform and validate query parameters', async () => {
      mockReq.query = {
        page: '2',
        limit: '20',
        sort: 'asc',
        filter: 'active,verified'
      };

      const middleware = validateQuery(querySchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.query).toEqual({
        page: 2,
        limit: 20,
        sort: 'asc',
        filter: ['active', 'verified']
      });
    });

    it('should handle boolean transformation', async () => {
      const boolSchema = z.object({
        active: z.boolean(),
        verified: z.boolean()
      });

      mockReq.query = {
        active: 'true',
        verified: 'false'
      };

      const middleware = validateQuery(boolSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.query).toEqual({
        active: true,
        verified: false
      });
    });
  });

  describe('validateParams', () => {
    const paramsSchema = z.object({
      id: z.string().regex(/^\d+$/),
      slug: z.string().min(3)
    });

    it('should validate path parameters', async () => {
      mockReq.params = {
        id: '123',
        slug: 'test-slug'
      };

      const middleware = validateParams(paramsSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.validated?.params).toEqual({
        id: '123',
        slug: 'test-slug'
      });
    });

    it('should reject invalid params', async () => {
      mockReq.params = {
        id: 'abc', // not numeric
        slug: 'ts' // too short
      };

      const middleware = validateParams(paramsSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('validateAll', () => {
    const schemas = {
      body: z.object({ name: z.string() }),
      query: z.object({ page: z.number() }),
      params: z.object({ id: z.string() })
    };

    it('should validate all parts of request', async () => {
      mockReq.body = { name: 'Test' };
      mockReq.query = { page: '1' };
      mockReq.params = { id: '123' };

      const middleware = validateAll(schemas);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect(mockReq.body).toEqual({ name: 'Test' });
      expect(mockReq.query).toEqual({ page: 1 });
      expect(mockReq.params).toEqual({ id: '123' });
    });

    it('should stop on first validation error', async () => {
      mockReq.body = { name: 123 }; // invalid type
      mockReq.query = { page: 'invalid' };

      const middleware = validateAll(schemas);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockNext).not.toHaveBeenCalled();
      // Should fail on body validation and not reach query validation
      expect(mockRes.json).toHaveBeenCalledTimes(1);
    });
  });

  describe('createValidatedHandler', () => {
    const schemas = {
      body: z.object({ name: z.string() }),
      query: z.object({ page: z.number() })
    };

    it('should create a handler with validation', async () => {
      const handler = jest.fn().mockImplementation((req, res) => {
        res.json({ success: true });
      });

      mockReq.body = { name: 'Test' };
      mockReq.query = { page: '1' };

      const validatedHandler = createValidatedHandler(schemas, handler);
      await validatedHandler(mockReq as Request, mockRes as Response, mockNext);

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          body: { name: 'Test' },
          query: { page: 1 }
        }),
        mockRes,
        mockNext
      );
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });

    it('should not call handler on validation error', async () => {
      const handler = jest.fn();

      mockReq.body = { name: 123 }; // invalid

      const validatedHandler = createValidatedHandler(schemas, handler);
      await validatedHandler(mockReq as Request, mockRes as Response, mockNext);

      expect(handler).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle async handler errors', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('Handler error'));

      mockReq.body = { name: 'Test' };
      mockReq.query = { page: '1' };

      const validatedHandler = createValidatedHandler(schemas, handler);
      await validatedHandler(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});