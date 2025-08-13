import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { 
  generateTokens, 
  verifyAccessToken, 
  verifyRefreshToken,
  refreshTokens,
  revokeRefreshToken,
  isUserBlacklisted,
  blacklistUser,
  unblacklistUser,
  generateSecureToken,
  hashPassword,
  verifyPassword
} from '../../server/services/auth';
import { cache } from '../../server/services/cache';
import { AuthenticationError } from '../../server/utils/errors';

// Mock dependencies
jest.mock('../../server/services/cache');
jest.mock('jsonwebtoken');

describe('Auth Service - Extended Tests', () => {
  const mockUser = {
    userId: 'test-user-123',
    telegramId: 'tg-123',
    username: 'testuser'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default environment variables
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-characters';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-characters';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';
    process.env.JWT_ISSUER = 'test-issuer';
    process.env.JWT_AUDIENCE = 'test-audience';
  });

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', async () => {
      const mockAccessToken = 'mock-access-token';
      const mockRefreshToken = 'mock-refresh-token';
      
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);
      
      (cache.set as unknown as jest.Mock).mockResolvedValue('OK');
      
      const tokens = await generateTokens(mockUser);
      
      expect(tokens).toEqual({
        accessToken: mockAccessToken,
        refreshToken: mockRefreshToken,
        expiresIn: expect.any(Number)
      });
      
      // Verify JWT was called correctly
      expect(jwt.sign).toHaveBeenCalledTimes(2);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.userId,
          telegramId: mockUser.telegramId,
          username: mockUser.username,
          type: 'access'
        }),
        'test-access-secret-min-32-characters',
        expect.objectContaining({
          expiresIn: process.env.JWT_ACCESS_EXPIRY,
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE
        }) as any
      );
      
      // Verify refresh token was cached
      expect(cache.set).toHaveBeenCalledWith(
        `refresh_token:${mockUser.userId}:${mockRefreshToken}`,
        '1',
        7 * 24 * 60 * 60 // 7 days in seconds
      );
    });

    it('should handle missing environment variables', async () => {
      delete process.env.JWT_ACCESS_SECRET;
      
      await expect(generateTokens(mockUser))
        .rejects.toThrow('JWT secrets not configured');
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', async () => {
      const mockPayload = {
        userId: mockUser.userId,
        telegramId: mockUser.telegramId,
        type: 'access',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 900 // 15 minutes
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      const result = await verifyAccessToken('valid-token');
      
      expect(result).toEqual(mockPayload);
      expect(jwt.verify).toHaveBeenCalledWith(
        'valid-token',
        'test-access-secret-min-32-characters',
        expect.objectContaining({
          issuer: process.env.JWT_ISSUER,
          audience: process.env.JWT_AUDIENCE
        }) as any
      );
    });

    it('should reject invalid token type', async () => {
      const mockPayload = {
        userId: mockUser.userId,
        type: 'refresh', // Wrong type
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 900
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      await expect(verifyAccessToken('invalid-type-token'))
        .rejects.toThrow(AuthenticationError);
    });

    it('should handle expired tokens', async () => {
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('TokenExpiredError');
      });
      
      await expect(verifyAccessToken('expired-token'))
        .rejects.toThrow();
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const oldRefreshToken = 'old-refresh-token';
      const mockPayload = {
        userId: mockUser.userId,
        telegramId: mockUser.telegramId,
        username: mockUser.username,
        type: 'refresh'
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      (cache.get as unknown as jest.Mock).mockResolvedValue('1');
      (cache.del as unknown as jest.Mock).mockResolvedValue(1);
      
      const newTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token'
      };
      
      (jwt.sign as jest.Mock)
        .mockReturnValueOnce(newTokens.accessToken)
        .mockReturnValueOnce(newTokens.refreshToken);
      
      (cache.set as unknown as jest.Mock).mockResolvedValue('OK');
      
      const result = await refreshTokens(oldRefreshToken);
      
      expect(result).toEqual({ ...newTokens, expiresIn: expect.any(Number) });
      
      // Verify old token was deleted
      expect(cache.del).toHaveBeenCalledWith(
        `refresh_token:${mockUser.userId}:${oldRefreshToken}`
      );
      
      // Verify new refresh token was stored
      expect(cache.set).toHaveBeenCalledWith(
        `refresh_token:${mockUser.userId}:${newTokens.refreshToken}`,
        '1',
        expect.any(Number)
      );
    });

    it('should reject if refresh token not found in cache', async () => {
      const mockPayload = {
        userId: mockUser.userId,
        type: 'refresh'
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      (cache.get as unknown as jest.Mock).mockResolvedValue(null);
      
      await expect(refreshTokens('invalid-refresh-token'))
        .rejects.toThrow(AuthenticationError);
    });
  });

  describe('blacklisting functionality', () => {
    it('should blacklist a user', async () => {
      (cache.set as unknown as jest.Mock).mockResolvedValue('OK');
      
      await blacklistUser(mockUser.userId);
      
      expect(cache.set).toHaveBeenCalledWith(
        `blacklist:${mockUser.userId}`,
        '1',
        expect.anything()
      );
    });

    it('should check if user is blacklisted', async () => {
      (cache.get as unknown as jest.Mock).mockResolvedValue('1');
      
      const isBlacklisted = await isUserBlacklisted(mockUser.userId);
      
      expect(isBlacklisted).toBe(true);
      expect(cache.get).toHaveBeenCalledWith(`blacklist:${mockUser.userId}`);
    });

    it('should unblacklist a user', async () => {
      (cache.del as unknown as jest.Mock).mockResolvedValue(1);
      
      await unblacklistUser(mockUser.userId);
      
      expect(cache.del).toHaveBeenCalledWith(`blacklist:${mockUser.userId}`);
    });
  });

  describe('password utilities', () => {
    it('should hash and verify passwords', async () => {
      const plainPassword = 'SuperSecurePassword123!';
      
      // Mock bcrypt-like behavior
      const hashedPassword = await hashPassword(plainPassword);
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(plainPassword);
      expect(hashedPassword.length).toBeGreaterThan(20);
      
      // Verify password
      const isValid = await verifyPassword(plainPassword, hashedPassword);
      expect(isValid).toBe(true);
      
      // Verify wrong password fails
      const isInvalid = await verifyPassword('WrongPassword', hashedPassword);
      expect(isInvalid).toBe(false);
    });
  });

  describe('secure token generation', () => {
    it('should generate cryptographically secure tokens', () => {
      const token1 = generateSecureToken();
      const token2 = generateSecureToken();
      
      expect(token1).toBeDefined();
      expect(token2).toBeDefined();
      expect(token1).not.toBe(token2); // Should be unique
      expect(token1.length).toBeGreaterThan(20); // Should be sufficiently long
    });

    it('should generate tokens of specified length', () => {
      const customLength = 64;
      const token = generateSecureToken(customLength);
      
      expect(token.length).toBe(customLength * 2); // Hex encoding doubles length
    });
  });

  describe('error handling', () => {
    it('should handle cache errors gracefully', async () => {
      (cache.set as unknown as jest.Mock).mockRejectedValue(new Error('Redis connection failed'));
      
      await expect(blacklistUser(mockUser.userId))
        .rejects.toThrow('Failed to blacklist user');
    });

    it('should validate token payload structure', async () => {
      const invalidPayload = {
        // Missing required fields
        someField: 'value'
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(invalidPayload);
      
      await expect(verifyAccessToken('malformed-token'))
        .rejects.toThrow(AuthenticationError);
    });
  });

  describe('security edge cases', () => {
    it('should prevent token reuse after revocation', async () => {
      const refreshToken = 'refresh-token-to-revoke';
      
      // First, revoke the token
      (cache.del as unknown as jest.Mock).mockResolvedValue(1);
      await revokeRefreshToken(mockUser.userId, refreshToken);
      
      // Then try to use it
      (cache.get as unknown as jest.Mock).mockResolvedValue(null);
      (jwt.verify as jest.Mock).mockReturnValue({
        userId: mockUser.userId,
        type: 'refresh'
      });
      
      await expect(refreshTokens(refreshToken))
        .rejects.toThrow(AuthenticationError);
    });

    it('should handle concurrent token refresh attempts', async () => {
      // Simulate race condition where multiple requests try to refresh
      // with the same token simultaneously
      const refreshToken = 'concurrent-refresh-token';
      const mockPayload = {
        userId: mockUser.userId,
        type: 'refresh'
      };
      
      (jwt.verify as jest.Mock).mockReturnValue(mockPayload);
      
      // First request gets the token
      (cache.get as unknown as jest.Mock).mockResolvedValueOnce('1');
      // Second request finds token already deleted
      (cache.get as unknown as jest.Mock).mockResolvedValueOnce(null);
      
      const promise1 = refreshTokens(refreshToken);
      const promise2 = refreshTokens(refreshToken);
      
      // One should succeed, one should fail
      const results = await Promise.allSettled([promise1, promise2]);
      const successes = results.filter(r => r.status === 'fulfilled');
      const failures = results.filter(r => r.status === 'rejected');
      
      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);
    });
  });
});