import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import {
  extractToken,
  authenticate,
  requireAuth,
  optionalAuth,
  authorize,
  authorizeOwner,
  extractUserId
} from '../../server/middleware/auth';
import * as authService from '../../server/services/auth';
import logger from '../../server/utils/logger';

// Mock dependencies
jest.mock('../../server/services/auth');
jest.mock('../../server/utils/logger');

describe('Auth Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      params: {},
      query: {},
      body: {}
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  describe('extractToken', () => {
    it('should extract token from Authorization header', () => {
      mockReq.headers.authorization = 'Bearer test-token-123';
      
      const token = extractToken(mockReq);
      
      expect(token).toBe('test-token-123');
    });

    it('should extract token from lowercase authorization header', () => {
      mockReq.headers.authorization = 'bearer test-token-456';
      
      const token = extractToken(mockReq);
      
      expect(token).toBe('test-token-456');
    });

    it('should return null if no authorization header', () => {
      const token = extractToken(mockReq);
      
      expect(token).toBeNull();
    });

    it('should return null if authorization header has wrong format', () => {
      mockReq.headers.authorization = 'Basic dGVzdDp0ZXN0';
      
      const token = extractToken(mockReq);
      
      expect(token).toBeNull();
    });
  });

  describe('authenticate', () => {
    it('should authenticate valid token and set user', async () => {
      const mockPayload = { userId: 'user-123', type: 'access' };
      mockReq.headers.authorization = 'Bearer valid-token';
      
      (authService.verifyAccessToken as jest.Mock).mockResolvedValue({
        valid: true,
        payload: mockPayload
      });

      await authenticate(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual({ id: 'user-123' });
      expect(mockReq.auth).toEqual({ token: 'valid-token', payload: mockPayload });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle missing token when not required', async () => {
      await authenticate(mockReq, mockRes, mockNext, { required: false });

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject missing token when required', async () => {
      await authenticate(mockReq, mockRes, mockNext, { required: true });

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      mockReq.headers.authorization = 'Bearer invalid-token';
      
      (authService.verifyAccessToken as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Invalid token signature'
      });

      await authenticate(mockReq, mockRes, mockNext, { required: true });

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Invalid token signature'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject blacklisted user', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      
      (authService.verifyAccessToken as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'User is blacklisted'
      });

      await authenticate(mockReq, mockRes, mockNext, { required: true });

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'User is blacklisted'
      });
    });

    it('should check blacklist when enabled', async () => {
      const mockPayload = { userId: 'user-123', type: 'access' };
      mockReq.headers.authorization = 'Bearer valid-token';
      
      (authService.verifyAccessToken as jest.Mock).mockResolvedValue({
        valid: true,
        payload: mockPayload
      });
      (authService.isUserBlacklisted as jest.Mock).mockResolvedValue(true);

      await authenticate(mockReq, mockRes, mockNext, { checkBlacklist: true });

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'User is blacklisted'
      });
    });
  });

  describe('requireAuth', () => {
    it('should require authentication', async () => {
      await requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'No authentication token provided'
      });
    });

    it('should pass with valid token', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      
      (authService.verifyAccessToken as jest.Mock).mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123', type: 'access' }
      });

      await requireAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });
  });

  describe('optionalAuth', () => {
    it('should allow requests without token', async () => {
      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeUndefined();
    });

    it('should authenticate if token provided', async () => {
      mockReq.headers.authorization = 'Bearer valid-token';
      
      (authService.verifyAccessToken as jest.Mock).mockResolvedValue({
        valid: true,
        payload: { userId: 'user-123', type: 'access' }
      });

      await optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeDefined();
    });
  });

  describe('authorize', () => {
    it('should authorize user with correct role', async () => {
      mockReq.user = { id: 'user-123', role: 'admin' };
      
      const middleware = authorize('admin');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject user with wrong role', async () => {
      mockReq.user = { id: 'user-123', role: 'user' };
      
      const middleware = authorize('admin');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle multiple allowed roles', async () => {
      mockReq.user = { id: 'user-123', role: 'moderator' };
      
      const middleware = authorize('admin', 'moderator');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject unauthenticated user', async () => {
      const middleware = authorize('admin');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    });
  });

  describe('authorizeOwner', () => {
    it('should authorize resource owner from params', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params.userId = 'user-123';
      
      const middleware = authorizeOwner('userId');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should authorize resource owner from body', async () => {
      mockReq.user = { id: 'user-456' };
      mockReq.body.ownerId = 'user-456';
      
      const middleware = authorizeOwner('ownerId');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should authorize resource owner from query', async () => {
      mockReq.user = { id: 'user-789' };
      mockReq.query.userId = 'user-789';
      
      const middleware = authorizeOwner('userId');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should reject non-owner', async () => {
      mockReq.user = { id: 'user-123' };
      mockReq.params.userId = 'user-456';
      
      const middleware = authorizeOwner('userId');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject unauthenticated user', async () => {
      mockReq.params.userId = 'user-123';
      
      const middleware = authorizeOwner('userId');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    });

    it('should handle missing resource ID', async () => {
      mockReq.user = { id: 'user-123' };
      
      const middleware = authorizeOwner('userId');
      await middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Forbidden',
        message: 'You can only access your own resources'
      });
    });
  });

  describe('extractUserId', () => {
    it('should extract userId from authenticated request', () => {
      mockReq.user = { id: 'user-123' };
      
      const userId = extractUserId(mockReq);
      
      expect(userId).toBe('user-123');
    });

    it('should extract userId from auth payload', () => {
      mockReq.auth = { payload: { userId: 'user-456' } };
      
      const userId = extractUserId(mockReq);
      
      expect(userId).toBe('user-456');
    });

    it('should return null for unauthenticated request', () => {
      const userId = extractUserId(mockReq);
      
      expect(userId).toBeNull();
    });
  });
});