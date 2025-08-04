import { Router } from 'express';
import { z } from 'zod';
import { validateBody, createValidatedHandler } from '../middleware/validation';
import { requireAuth } from '../middleware/auth';
import { 
  generateTokens, 
  refreshTokens, 
  invalidateAllTokens,
  generateTelegramWebAppToken 
} from '../services/auth';
import { db } from '../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { asyncHandler } from '../utils/errors';
import logger from '../utils/logger';

const router = Router();

/**
 * Схемы валидации
 */
const telegramAuthSchema = z.object({
  initData: z.string().min(1)
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1)
});

/**
 * @swagger
 * /auth/telegram:
 *   post:
 *     summary: Authenticate with Telegram Web App data
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - initData
 *             properties:
 *               initData:
 *                 type: string
 *                 description: Telegram Web App init data
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *                 user:
 *                   type: object
 *       400:
 *         description: Invalid Telegram data
 *       500:
 *         description: Internal server error
 */
router.post('/telegram',
  validateBody(telegramAuthSchema),
  asyncHandler(async (req, res) => {
    const { initData } = req.body;
    
    try {
      const tokens = await generateTelegramWebAppToken(initData);
      
      // Получаем данные пользователя
      const userData = JSON.parse(new URLSearchParams(initData).get('user') || '{}');
      const userId = userData.id?.toString();
      
      if (!userId) {
        return res.status(400).json({
          error: 'Invalid Request',
          message: 'User ID not found in Telegram data'
        });
      }
      
      // Получаем профиль пользователя
      const [profile] = await db.select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);
      
      logger.info(`User ${userId} authenticated via Telegram Web App`);
      
      res.json({
        ...tokens,
        user: {
          userId,
          telegramId: userId,
          username: userData.username,
          firstName: userData.first_name,
          lastName: userData.last_name,
          hasProfile: !!profile
        }
      });
    } catch (error: any) {
      logger.error('Telegram authentication error:', error);
      
      if (error.message === 'Invalid Telegram Web App data') {
        return res.status(400).json({
          error: 'Invalid Request',
          message: 'The provided Telegram data is invalid or expired'
        });
      }
      
      throw error;
    }
  })
);

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh token
 *     responses:
 *       200:
 *         description: New tokens generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                 refreshToken:
 *                   type: string
 *                 expiresIn:
 *                   type: number
 *       401:
 *         description: Invalid or expired refresh token
 *       500:
 *         description: Internal server error
 */
router.post('/refresh',
  validateBody(refreshTokenSchema),
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    
    try {
      const tokens = await refreshTokens(refreshToken);
      
      logger.info('Tokens refreshed successfully');
      
      res.json(tokens);
    } catch (error: any) {
      logger.warn('Token refresh failed:', error.message);
      
      if (error.message.includes('expired')) {
        return res.status(401).json({
          error: 'Token Expired',
          message: 'Refresh token has expired',
          code: 'REFRESH_TOKEN_EXPIRED'
        });
      }
      
      if (error.message.includes('Invalid') || error.message.includes('not found')) {
        return res.status(401).json({
          error: 'Invalid Token',
          message: 'Invalid or revoked refresh token',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }
      
      throw error;
    }
  })
);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Logout user and invalidate all tokens
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully logged out
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/logout',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.userId;
    
    await invalidateAllTokens(userId);
    
    logger.info(`User ${userId} logged out`);
    
    res.json({
      message: 'Successfully logged out'
    });
  })
);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current user information
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                 telegramId:
 *                   type: string
 *                 username:
 *                   type: string
 *                 profile:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    
    // Получаем профиль пользователя
    const [profile] = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, user.userId))
      .limit(1);
    
    res.json({
      userId: user.userId,
      telegramId: user.telegramId,
      username: user.username,
      profile: profile || null
    });
  })
);

export default router;