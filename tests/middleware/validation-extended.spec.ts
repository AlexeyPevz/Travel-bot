import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  validateParams,
  validateAll,
  createValidatedHandler,
  ValidationError
} from '../../server/middleware/validation';
import { Request, Response, NextFunction } from 'express';

describe('Validation Middleware - Extended Tests', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {},
      query: {},
      params: {},
      method: 'POST',
      path: '/test',
      ip: '127.0.0.1'
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  describe('validateBody', () => {
    const testSchema = z.object({
      name: z.string().min(3).max(50),
      age: z.number().min(0).max(150),
      email: z.string().email(),
      tags: z.array(z.string()).optional()
    });

    it('should validate valid body data', async () => {
      mockReq.body = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        tags: ['developer', 'nodejs']
      };

      const middleware = validateBody(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject invalid body data with detailed errors', async () => {
      mockReq.body = {
        name: 'Jo', // Too short
        age: 200, // Too old
        email: 'invalid-email', // Invalid format
        tags: ['valid', 123] // Mixed types
      };

      const middleware = validateBody(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'name',
              message: expect.stringContaining('at least 3 characters')
            }),
            expect.objectContaining({
              field: 'age',
              message: expect.stringContaining('less than or equal to 150')
            }),
            expect.objectContaining({
              field: 'email',
              message: expect.stringContaining('Invalid email')
            })
          ])
        })
      );
    });

    it('should handle missing required fields', async () => {
      mockReq.body = {
        name: 'John Doe'
        // Missing age and email
      };

      const middleware = validateBody(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'age',
              message: expect.stringContaining('Required')
            }),
            expect.objectContaining({
              field: 'email',
              message: expect.stringContaining('Required')
            })
          ])
        })
      );
    });

    it('should strip unknown fields', async () => {
      mockReq.body = {
        name: 'John Doe',
        age: 30,
        email: 'john@example.com',
        unknownField: 'should be removed'
      };

      const middleware = validateBody(testSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.body).not.toHaveProperty('unknownField');
    });
  });

  describe('validateQuery', () => {
    const querySchema = z.object({
      page: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1)),
      limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(100)),
      sort: z.enum(['asc', 'desc']).optional(),
      filter: z.string().optional()
    });

    it('should validate and transform query parameters', async () => {
      mockReq.query = {
        page: '2',
        limit: '20',
        sort: 'asc'
      };

      const middleware = validateQuery(querySchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.query).toEqual({
        page: 2,
        limit: 20,
        sort: 'asc'
      });
    });

    it('should reject invalid query parameters', async () => {
      mockReq.query = {
        page: '0', // Less than minimum
        limit: '200', // More than maximum
        sort: 'invalid' // Not in enum
      };

      const middleware = validateQuery(querySchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateParams', () => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
      slug: z.string().regex(/^[a-z0-9-]+$/)
    });

    it('should validate URL parameters', async () => {
      mockReq.params = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        slug: 'valid-slug-123'
      };

      const middleware = validateParams(paramsSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject invalid URL parameters', async () => {
      mockReq.params = {
        id: 'not-a-uuid',
        slug: 'Invalid_Slug!' // Contains invalid characters
      };

      const middleware = validateParams(paramsSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('validateAll', () => {
    const schemas = {
      body: z.object({ name: z.string() }),
      query: z.object({ page: z.string() }),
      params: z.object({ id: z.string() })
    };

    it('should validate all parts of the request', async () => {
      mockReq.body = { name: 'Test' };
      mockReq.query = { page: '1' };
      mockReq.params = { id: '123' };

      const middleware = validateAll(schemas);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should fail if any part is invalid', async () => {
      mockReq.body = { name: 'Test' };
      mockReq.query = {}; // Missing required page
      mockReq.params = { id: '123' };

      const middleware = validateAll(schemas);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createValidatedHandler', () => {
    const handlerSchema = z.object({
      body: z.object({
        message: z.string()
      })
    });

    it('should create a validated handler', async () => {
      const handler = jest.fn().mockResolvedValue({ success: true });
      const validatedHandler = createValidatedHandler(handlerSchema, handler);

      mockReq.body = { message: 'Hello' };
      
      await validatedHandler(mockReq as Request, mockRes as Response, mockNext);

      expect(handler).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it('should not call handler if validation fails', async () => {
      const handler = jest.fn();
      const validatedHandler = createValidatedHandler(handlerSchema, handler);

      mockReq.body = {}; // Missing required field
      
      await validatedHandler(mockReq as Request, mockRes as Response, mockNext);

      expect(handler).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });

  describe('Complex validation scenarios', () => {
    it('should handle nested object validation', async () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            firstName: z.string(),
            lastName: z.string(),
            preferences: z.object({
              theme: z.enum(['light', 'dark']),
              notifications: z.boolean()
            })
          }),
          settings: z.object({
            privacy: z.enum(['public', 'private', 'friends']),
            language: z.string().length(2)
          })
        })
      });

      mockReq.body = {
        user: {
          profile: {
            firstName: 'John',
            lastName: 'Doe',
            preferences: {
              theme: 'dark',
              notifications: true
            }
          },
          settings: {
            privacy: 'private',
            language: 'en'
          }
        }
      };

      const middleware = validateBody(nestedSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle array validation with complex items', async () => {
      const arraySchema = z.object({
        items: z.array(z.object({
          id: z.number(),
          name: z.string(),
          tags: z.array(z.string()),
          metadata: z.record(z.string(), z.any()).optional()
        })).min(1).max(10)
      });

      mockReq.body = {
        items: [
          {
            id: 1,
            name: 'Item 1',
            tags: ['tag1', 'tag2'],
            metadata: { color: 'red', size: 'large' }
          },
          {
            id: 2,
            name: 'Item 2',
            tags: ['tag3']
          }
        ]
      };

      const middleware = validateBody(arraySchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle conditional validation', async () => {
      const conditionalSchema = z.object({
        type: z.enum(['personal', 'business']),
        name: z.string(),
        companyName: z.string().optional(),
        taxId: z.string().optional()
      }).refine(
        (data) => {
          if (data.type === 'business') {
            return data.companyName && data.taxId;
          }
          return true;
        },
        {
          message: 'Company name and tax ID are required for business accounts'
        }
      );

      // Test valid personal account
      mockReq.body = {
        type: 'personal',
        name: 'John Doe'
      };

      let middleware = validateBody(conditionalSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // Reset mocks
      jest.clearAllMocks();

      // Test invalid business account
      mockReq.body = {
        type: 'business',
        name: 'ACME Corp'
        // Missing companyName and taxId
      };

      middleware = validateBody(conditionalSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });

    it('should handle custom error messages', async () => {
      const customMessageSchema = z.object({
        password: z.string()
          .min(8, 'Password must be at least 8 characters')
          .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
          .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
          .regex(/[0-9]/, 'Password must contain at least one number')
          .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
      });

      mockReq.body = {
        password: 'weak'
      };

      const middleware = validateBody(customMessageSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining('at least 8 characters')
            })
          ])
        })
      );
    });
  });

  describe('Performance and edge cases', () => {
    it('should handle large payload validation efficiently', async () => {
      const largeSchema = z.object({
        items: z.array(z.object({
          id: z.number(),
          data: z.string()
        }))
      });

      // Create a large payload
      const items = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        data: `Item ${i}`
      }));

      mockReq.body = { items };

      const startTime = Date.now();
      const middleware = validateBody(largeSchema);
      await middleware(mockReq as Request, mockRes as Response, mockNext);
      const endTime = Date.now();

      expect(mockNext).toHaveBeenCalled();
      expect(endTime - startTime).toBeLessThan(100); // Should validate in less than 100ms
    });

    it('should handle circular references gracefully', async () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      mockReq.body = circularObj;

      const simpleSchema = z.object({ name: z.string() });
      const middleware = validateBody(simpleSchema);
      
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      // Should handle circular reference without crashing
      expect(mockRes.status).toHaveBeenCalledWith(400);
    });
  });
});