import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  generateTokens,
  verifyAccessToken,
  refreshTokens,
  invalidateRefreshToken,
  invalidateAllTokens,
  isUserBlacklisted,
  decodeToken,
  checkUserExists,
  getTokenExpirySeconds
} from '../../server/services/auth';
import { cacheService } from '../../server/services/cache';
import { db } from '../../db';
import jwt from 'jsonwebtoken';

// Mock dependencies
jest.mock('../../server/services/cache');
jest.mock('../../db');
jest.mock('jsonwebtoken');

describe('Auth Service', () => {
  const mockUserId = 'test-user-123';
  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.JWT_ISSUER = 'test-issuer';
    process.env.JWT_AUDIENCE = 'test-audience';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const mockAccessToken = 'access-token';
      const mockRefreshToken = 'refresh-token';
      
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      const tokens = await generateTokens(mockUserId);

      expect(tokens).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken
      });

      expect(jwt.sign).toHaveBeenCalledTimes(2);
      
      // Check access token generation
      expect(jwt.sign).toHaveBeenNthCalledWith(
        1,
        { userId: mockUserId, type: 'access' },
        'test-access-secret',
        expect.objectContaining({
          expiresIn: '15m',
          issuer: 'test-issuer',
          audience: 'test-audience'
        })
      );

      // Check refresh token generation
      expect(jwt.sign).toHaveBeenNthCalledWith(
        2,
        { userId: mockUserId, type: 'refresh' },
        'test-refresh-secret',
        expect.objectContaining({
          expiresIn: '7d',
          issuer: 'test-issuer',
          audience: 'test-audience'
        })
      );
    });

    it('should throw error if JWT secrets are not configured', async () => {
      delete process.env.JWT_ACCESS_SECRET;
      
      await expect(generateTokens(mockUserId)).rejects.toThrow('JWT secrets not configured');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const mockPayload = {
        userId: mockUserId,
        type: 'access',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 900 // 15 minutes
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      (cacheService.get as jest.Mock).mockResolvedValue(null); // Not blacklisted

      const result = await verifyAccessToken(mockTokens.accessToken);

      expect(result.valid).toBe(true);
      expect(result.payload).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith(
        mockTokens.accessToken,
        'test-access-secret',
        expect.objectContaining({
          issuer: 'test-issuer',
          audience: 'test-audience'
        })
      );
    });

    it('should reject blacklisted user token', async () => {
      const mockPayload = {
        userId: mockUserId,
        type: 'access'
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      (cacheService.get as jest.Mock).mockResolvedValue('blacklisted');

      const result = await verifyAccessToken(mockTokens.accessToken);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('User is blacklisted');
    });

    it('should reject invalid token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const result = await verifyAccessToken('invalid-token');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid token');
    });

    it('should reject expired token', async () => {
      const error = new Error('Token expired') as any;
      error.name = 'TokenExpiredError';
      
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw error;
      });

      const result = await verifyAccessToken('expired-token');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Token has expired');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const mockPayload = {
        userId: mockUserId,
        type: 'refresh',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 604800 // 7 days
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      (cacheService.get as jest.Mock).mockResolvedValue(null); // Not blacklisted
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');

      const result = await refreshTokens(mockTokens.refreshToken);

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      });

      // Should invalidate old refresh token
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:refresh:'),
        'revoked',
        expect.any(Number)
      );
    });

    it('should reject invalid refresh token', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await expect(refreshTokens('invalid-token')).rejects.toThrow('Invalid refresh token');
    });

    it('should reject blacklisted refresh token', async () => {
      const mockPayload = {
        userId: mockUserId,
        type: 'refresh'
      };

      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      (cacheService.get as jest.Mock).mockResolvedValue('blacklisted');

      await expect(refreshTokens(mockTokens.refreshToken)).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('invalidateRefreshToken', () => {
    it('should blacklist refresh token', async () => {
      await invalidateRefreshToken(mockTokens.refreshToken);

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('blacklist:refresh:'),
        'revoked',
        expect.any(Number)
      );
    });
  });

  describe('invalidateAllTokens', () => {
    it('should blacklist all user tokens', async () => {
      await invalidateAllTokens(mockUserId);

      expect(cacheService.set).toHaveBeenCalledWith(
        `auth:blacklist:user:${mockUserId}`,
        'blacklisted',
        expect.any(Number)
      );
    });
  });

  describe('isUserBlacklisted', () => {
    it('should return true for blacklisted user', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue('blacklisted');

      const result = await isUserBlacklisted(mockUserId);

      expect(result).toBe(true);
      expect(cacheService.get).toHaveBeenCalledWith(`auth:blacklist:user:${mockUserId}`);
    });

    it('should return false for non-blacklisted user', async () => {
      (cacheService.get as jest.Mock).mockResolvedValue(null);

      const result = await isUserBlacklisted(mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('decodeToken', () => {
    it('should decode token without verification', () => {
      const mockPayload = { userId: mockUserId };
      (jwt.decode as jest.Mock).mockReturnValue(mockPayload);

      const result = decodeToken(mockTokens.accessToken);

      expect(result).toEqual(mockPayload);
      expect(jwt.decode).toHaveBeenCalledWith(mockTokens.accessToken);
    });

    it('should return null for invalid token', () => {
      (jwt.decode as jest.Mock).mockReturnValue(null);

      const result = decodeToken('invalid-token');

      expect(result).toBeNull();
    });
  });

  describe('checkUserExists', () => {
    it('should return true if user exists', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ userId: mockUserId }])
          })
        })
      });

      const exists = await checkUserExists(mockUserId);

      expect(exists).toBe(true);
    });

    it('should return false if user does not exist', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      });

      const exists = await checkUserExists(mockUserId);

      expect(exists).toBe(false);
    });
  });

  describe('getTokenExpirySeconds', () => {
    it('should convert time strings to seconds', () => {
      expect(getTokenExpirySeconds('1h')).toBe(3600);
      expect(getTokenExpirySeconds('15m')).toBe(900);
      expect(getTokenExpirySeconds('7d')).toBe(604800);
      expect(getTokenExpirySeconds('30s')).toBe(30);
    });

    it('should return number as-is', () => {
      expect(getTokenExpirySeconds(3600)).toBe(3600);
      expect(getTokenExpirySeconds('3600')).toBe(3600);
    });

    it('should throw for invalid format', () => {
      expect(() => getTokenExpirySeconds('invalid')).toThrow('Invalid expiry format');
      expect(() => getTokenExpirySeconds('15x')).toThrow('Invalid expiry format');
    });
  });
});