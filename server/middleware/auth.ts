import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, isUserBlacklisted, decodeToken, DecodedToken } from '../services/auth';
import logger from '../utils/logger';

/**
 * Расширяем Express Request для добавления информации о пользователе
 */
declare global {
  namespace Express {
    interface Request {
      user?: DecodedToken;
      auth?: {
        token: string;
        type: 'Bearer' | 'Basic';
      };
    }
  }
}

/**
 * Интерфейс для опций middleware
 */
interface AuthOptions {
  /**
   * Разрешить ли доступ без токена (опциональная авторизация)
   */
  optional?: boolean;
  
  /**
   * Проверять ли blacklist (по умолчанию true)
   */
  checkBlacklist?: boolean;
  
  /**
   * Кастомное сообщение об ошибке
   */
  errorMessage?: string;
}

/**
 * Извлекает токен из заголовков запроса
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return null;
  }
  
  // Bearer token
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Токен может быть передан в query параметрах (для WebSocket)
  if (req.query.token && typeof req.query.token === 'string') {
    return req.query.token;
  }
  
  return null;
}

/**
 * Основной middleware для JWT авторизации
 */
export function authenticate(options: AuthOptions = {}) {
  const {
    optional = false,
    checkBlacklist = true,
    errorMessage = 'Authentication required'
  } = options;
  
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const token = extractToken(req);
      
      if (!token) {
        if (optional) {
          return next();
        }
        
        return res.status(401).json({
          error: 'Unauthorized',
          message: errorMessage
        });
      }
      
      // Сохраняем информацию о токене
      req.auth = {
        token,
        type: 'Bearer'
      };
      
      // Верифицируем токен
      const decoded = await verifyAccessToken(token);
      
      // Проверяем blacklist если необходимо
      if (checkBlacklist && await isUserBlacklisted(decoded.userId)) {
        logger.warn(`Blacklisted user ${decoded.userId} tried to access ${req.path}`);
        
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Token has been revoked'
        });
      }
      
      // Добавляем информацию о пользователе в request
      req.user = decoded;
      
      logger.debug(`User ${decoded.userId} authenticated for ${req.method} ${req.path}`);
      
      next();
    } catch (error: any) {
      logger.warn(`Authentication failed: ${error.message}`, {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      // Различные типы ошибок
      if (error.message === 'Access token expired') {
        return res.status(401).json({
          error: 'Token Expired',
          message: 'Access token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (error.message === 'Invalid access token' || 
          error.message === 'Invalid token type') {
        return res.status(401).json({
          error: 'Invalid Token',
          message: 'The provided token is invalid',
          code: 'INVALID_TOKEN'
        });
      }
      
      if (error.message === 'User not found') {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User associated with token not found',
          code: 'USER_NOT_FOUND'
        });
      }
      
      // Общая ошибка
      return res.status(401).json({
        error: 'Unauthorized',
        message: errorMessage
      });
    }
  };
}

/**
 * Shorthand для обязательной авторизации
 */
export const requireAuth = authenticate({ optional: false });

/**
 * Shorthand для опциональной авторизации
 */
export const optionalAuth = authenticate({ optional: true });

/**
 * Middleware для проверки конкретных прав доступа
 */
export function authorize(...allowedUserIds: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    if (!allowedUserIds.includes(req.user.userId)) {
      logger.warn(`User ${req.user.userId} denied access to ${req.path} - insufficient permissions`);
      
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to access this resource'
      });
    }
    
    next();
  };
}

/**
 * Middleware для проверки, что пользователь имеет доступ к своим данным
 */
export function authorizeOwner(userIdParam: string = 'userId') {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    const requestedUserId = req.params[userIdParam] || req.body[userIdParam] || req.query[userIdParam];
    
    if (!requestedUserId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: `Missing ${userIdParam} parameter`
      });
    }
    
    if (req.user.userId !== requestedUserId) {
      logger.warn(`User ${req.user.userId} tried to access data of user ${requestedUserId}`);
      
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own data'
      });
    }
    
    next();
  };
}

/**
 * Декоратор для методов, требующих авторизации
 * (для использования в классах контроллеров)
 */
export function RequireAuth(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  
  descriptor.value = function(...args: any[]) {
    const [req, res, next] = args;
    
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    
    return originalMethod.apply(this, args);
  };
  
  return descriptor;
}

/**
 * Извлекает userId из токена без полной верификации
 * (для использования в WebSocket или других случаях)
 */
export function extractUserId(token: string): string | null {
  const decoded = decodeToken(token);
  return decoded?.userId || null;
}