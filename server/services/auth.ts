import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { cache, CACHE_TTL } from './cache';
import { db } from '../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';

/**
 * Интерфейс для JWT payload
 */
export interface JWTPayload {
  userId: string;
  telegramId: string;
  username?: string;
  type: 'access' | 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Интерфейс для декодированного токена
 */
export interface DecodedToken extends JWTPayload {
  iat: number;
  exp: number;
}

/**
 * Конфигурация JWT
 */
const JWT_CONFIG = {
  ACCESS_TOKEN_SECRET: process.env.JWT_ACCESS_SECRET || crypto.randomBytes(32).toString('hex'),
  REFRESH_TOKEN_SECRET: process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString('hex'),
  ACCESS_TOKEN_EXPIRY: process.env.JWT_ACCESS_EXPIRY || '15m',
  REFRESH_TOKEN_EXPIRY: process.env.JWT_REFRESH_EXPIRY || '7d',
  ISSUER: process.env.JWT_ISSUER || 'ai-travel-agent',
  AUDIENCE: process.env.JWT_AUDIENCE || 'ai-travel-agent-api'
};

// Предупреждение в production если используются дефолтные секреты
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
    logger.error('JWT secrets are not set in production! Using random secrets.');
  }
}

/**
 * Генерирует пару токенов (access и refresh)
 */
export async function generateTokens(payload: Omit<JWTPayload, 'type'>): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const accessPayload: JWTPayload = {
    ...payload,
    type: 'access'
  };

  const refreshPayload: JWTPayload = {
    ...payload,
    type: 'refresh'
  };

  const accessToken = jwt.sign(accessPayload, JWT_CONFIG.ACCESS_TOKEN_SECRET, {
    expiresIn: JWT_CONFIG.ACCESS_TOKEN_EXPIRY,
    issuer: JWT_CONFIG.ISSUER,
    audience: JWT_CONFIG.AUDIENCE
  });

  const refreshToken = jwt.sign(refreshPayload, JWT_CONFIG.REFRESH_TOKEN_SECRET, {
    expiresIn: JWT_CONFIG.REFRESH_TOKEN_EXPIRY,
    issuer: JWT_CONFIG.ISSUER,
    audience: JWT_CONFIG.AUDIENCE
  });

  // Сохраняем refresh token в кеше для возможности инвалидации
  const refreshCacheKey = `refresh_token:${payload.userId}`;
  await cache.set(refreshCacheKey, refreshToken, CACHE_TTL.REFRESH_TOKEN);

  // Вычисляем время жизни access токена в секундах
  const expiresIn = getTokenExpirySeconds(JWT_CONFIG.ACCESS_TOKEN_EXPIRY);

  logger.info(`Generated tokens for user ${payload.userId}`);

  return {
    accessToken,
    refreshToken,
    expiresIn
  };
}

/**
 * Верифицирует access токен
 */
export async function verifyAccessToken(token: string): Promise<DecodedToken> {
  try {
    const decoded = jwt.verify(token, JWT_CONFIG.ACCESS_TOKEN_SECRET, {
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE
    }) as DecodedToken;

    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }

    // Проверяем существование пользователя
    const userExists = await checkUserExists(decoded.userId);
    if (!userExists) {
      throw new Error('User not found');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw error;
  }
}

/**
 * Верифицирует refresh токен и генерирует новую пару токенов
 */
export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  try {
    const decoded = jwt.verify(refreshToken, JWT_CONFIG.REFRESH_TOKEN_SECRET, {
      issuer: JWT_CONFIG.ISSUER,
      audience: JWT_CONFIG.AUDIENCE
    }) as DecodedToken;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    // Проверяем, что refresh token все еще валидный в кеше
    const cachedToken = await cache.get(`refresh_token:${decoded.userId}`);
    if (cachedToken !== refreshToken) {
      throw new Error('Refresh token invalidated or not found');
    }

    // Проверяем существование пользователя
    const userExists = await checkUserExists(decoded.userId);
    if (!userExists) {
      throw new Error('User not found');
    }

    // Инвалидируем старый refresh token
    await invalidateRefreshToken(decoded.userId);

    // Генерируем новую пару токенов
    return generateTokens({
      userId: decoded.userId,
      telegramId: decoded.telegramId,
      username: decoded.username
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Инвалидирует refresh токен пользователя
 */
export async function invalidateRefreshToken(userId: string): Promise<void> {
  const refreshCacheKey = `refresh_token:${userId}`;
  await cache.del(refreshCacheKey);
  logger.info(`Invalidated refresh token for user ${userId}`);
}

/**
 * Инвалидирует все токены пользователя (logout)
 */
export async function invalidateAllTokens(userId: string): Promise<void> {
  // Инвалидируем refresh token
  await invalidateRefreshToken(userId);
  
  // Добавляем userId в blacklist на время жизни access token
  const blacklistKey = `token_blacklist:${userId}`;
  await cache.set(blacklistKey, true, getTokenExpirySeconds(JWT_CONFIG.ACCESS_TOKEN_EXPIRY));
  
  logger.info(`Invalidated all tokens for user ${userId}`);
}

/**
 * Проверяет, находится ли пользователь в blacklist
 */
export async function isUserBlacklisted(userId: string): Promise<boolean> {
  const blacklistKey = `token_blacklist:${userId}`;
  const blacklisted = await cache.get(blacklistKey);
  return !!blacklisted;
}

/**
 * Декодирует токен без верификации (для получения payload)
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    return jwt.decode(token) as DecodedToken;
  } catch {
    return null;
  }
}

/**
 * Проверяет существование пользователя в БД
 */
async function checkUserExists(userId: string): Promise<boolean> {
  const [user] = await db.select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);
  
  return !!user;
}

/**
 * Конвертирует время жизни токена в секунды
 */
function getTokenExpirySeconds(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 900; // 15 минут по умолчанию
  }
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 60 * 60;
    case 'd': return value * 60 * 60 * 24;
    default: return 900;
  }
}

/**
 * Генерирует токен для Telegram Web App
 */
export async function generateTelegramWebAppToken(initData: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  // Верифицируем initData от Telegram
  const userData = verifyTelegramWebAppData(initData);
  
  if (!userData) {
    throw new Error('Invalid Telegram Web App data');
  }

  // Создаем или получаем профиль пользователя
  const userId = userData.id.toString();
  const [profile] = await db.select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (!profile) {
    // Создаем новый профиль
    await db.insert(profiles).values({
      userId,
      telegramUsername: userData.username,
      name: userData.first_name
    });
  }

  // Генерируем токены
  return generateTokens({
    userId,
    telegramId: userId,
    username: userData.username
  });
}

/**
 * Верифицирует данные от Telegram Web App
 */
function verifyTelegramWebAppData(initData: string): any {
  // TODO: Реализовать верификацию согласно документации Telegram
  // https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
  
  // Временная заглушка для разработки
  if (process.env.NODE_ENV === 'development') {
    try {
      const params = new URLSearchParams(initData);
      const userStr = params.get('user');
      if (userStr) {
        return JSON.parse(userStr);
      }
    } catch {
      // Ignore
    }
  }
  
  return null;
}

/**
 * Экспортируем конфигурацию для использования в других модулях
 */
export { JWT_CONFIG };