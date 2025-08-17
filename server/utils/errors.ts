import { Request, Response, NextFunction } from 'express';
import logger from './logger';

/**
 * Базовый класс для всех кастомных ошибок приложения
 */
export abstract class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly code?: string;
  public readonly details?: any;

  constructor(
    message: string,
    statusCode: number,
    isOperational = true,
    code?: string,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.code = code;
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
      stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
    };
  }
}

/**
 * Ошибка валидации данных
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, true, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

/**
 * Ошибка аутентификации
 */
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, true, 'AUTHENTICATION_ERROR');
    this.name = 'AuthenticationError';
  }
}

/**
 * Ошибка авторизации
 */
export class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, true, 'AUTHORIZATION_ERROR');
    this.name = 'AuthorizationError';
  }
}

/**
 * Ресурс не найден
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string | number) {
    const message = identifier
      ? `${resource} with id ${identifier} not found`
      : `${resource} not found`;
    super(message, 404, true, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Конфликт данных
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, true, 'CONFLICT_ERROR', details);
    this.name = 'ConflictError';
  }
}

/**
 * Ошибка rate limiting
 */
export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    const message = retryAfter
      ? `Too many requests. Try again in ${retryAfter} seconds`
      : 'Too many requests';
    super(message, 429, true, 'RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'RateLimitError';
  }
}

/**
 * Ошибка внешнего сервиса
 */
export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: any) {
    const message = `External service error: ${service}`;
    super(message, 503, true, 'EXTERNAL_SERVICE_ERROR', {
      service,
      originalError: originalError?.message || originalError,
    });
    this.name = 'ExternalServiceError';
  }
}

/**
 * Ошибка базы данных
 */
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: any) {
    super(message, 500, false, 'DATABASE_ERROR', {
      originalError: originalError?.message || originalError,
    });
    this.name = 'DatabaseError';
  }
}

/**
 * Обработчик для async функций в Express
 */
export const asyncHandler = <T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: T, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Глобальный обработчик ошибок для Express
 */
export const deprecatedErrorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Логирование ошибки
  logError(err, req);

  // Определяем тип ошибки
  if (err instanceof AppError) {
    return handleAppError(err, res);
  }

  // Обработка стандартных ошибок
  if (err.name === 'ValidationError') {
    return handleValidationError(err, res);
  }

  if (err.name === 'CastError') {
    return handleCastError(err, res);
  }

  if (err.name === 'JsonWebTokenError') {
    return handleJWTError(err, res);
  }

  // Обработка неизвестных ошибок
  return handleUnknownError(err as Error, res);
};

/**
 * Логирование ошибок
 */
function logError(err: Error | AppError, req: Request) {
  const errorInfo = {
    message: err.message,
    stack: (err as Error).stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.userId,
    correlationId: (req as any).correlationId,
  };

  if (err instanceof AppError && err.isOperational) {
    logger.warn('Operational error:', errorInfo);
  } else {
    logger.error('Unexpected error:', errorInfo);
  }
}

/**
 * Обработка AppError
 */
function handleAppError(err: AppError, res: Response) {
  res.status(err.statusCode).json({
    error: {
      message: err.message,
      code: err.code,
      details: err.details,
    },
  });
}

/**
 * Обработка ошибок валидации
 */
function handleValidationError(err: any, res: Response) {
  const errors = Object.values(err.errors || {}).map((e: any) => ({
    field: e.path,
    message: e.message,
  }));

  res.status(400).json({
    error: {
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors,
    },
  });
}

/**
 * Обработка ошибок преобразования типов
 */
function handleCastError(err: any, res: Response) {
  res.status(400).json({
    error: {
      message: `Invalid ${err.path}: ${err.value}`,
      code: 'INVALID_FORMAT',
    },
  });
}

/**
 * Обработка ошибок JWT
 */
function handleJWTError(err: any, res: Response) {
  const message = err.name === 'TokenExpiredError'
    ? 'Token has expired'
    : 'Invalid token';

  res.status(401).json({
    error: {
      message,
      code: 'AUTHENTICATION_ERROR',
    },
  });
}

/**
 * Обработка неизвестных ошибок
 */
function handleUnknownError(err: Error, res: Response) {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: {
      message: isDevelopment ? err.message : 'Internal server error',
      code: 'INTERNAL_ERROR',
      stack: isDevelopment ? err.stack : undefined,
    },
  });
}

/**
 * Обработчик для 404 ошибок
 */
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    error: {
      message: `Route ${req.originalUrl} not found`,
      code: 'ROUTE_NOT_FOUND',
    },
  });
};

/**
 * Утилита для создания безопасных ошибок для клиента
 */
export function sanitizeError(error: any): any {
  if (error instanceof AppError) {
    return error.toJSON();
  }

  // Скрываем детали внутренних ошибок в production
  if (process.env.NODE_ENV === 'production') {
    return {
      message: 'An error occurred',
      code: 'INTERNAL_ERROR',
    };
  }

  return {
    message: error.message || 'Unknown error',
    code: error.code || 'UNKNOWN_ERROR',
    details: error.details,
  };
}

/**
 * Типы ошибок для использования в приложении
 */
export const ErrorTypes = {
  VALIDATION: 'VALIDATION_ERROR',
  AUTHENTICATION: 'AUTHENTICATION_ERROR',
  AUTHORIZATION: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT_ERROR',
  RATE_LIMIT: 'RATE_LIMIT_ERROR',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE_ERROR',
  DATABASE: 'DATABASE_ERROR',
  INTERNAL: 'INTERNAL_ERROR',
} as const;

/**
 * Создает ошибку с контекстом
 */
export function createError(
  type: keyof typeof ErrorTypes,
  message: string,
  details?: any
): AppError {
  switch (type) {
    case 'VALIDATION':
      return new ValidationError(message, details);
    case 'AUTHENTICATION':
      return new AuthenticationError(message);
    case 'AUTHORIZATION':
      return new AuthorizationError(message);
    case 'NOT_FOUND':
      return new NotFoundError(message);
    case 'CONFLICT':
      return new ConflictError(message, details);
    case 'RATE_LIMIT':
      return new RateLimitError(details?.retryAfter);
    case 'EXTERNAL_SERVICE':
      return new ExternalServiceError(message, details);
    case 'DATABASE':
      return new DatabaseError(message, details);
    default:
      return new ValidationError(message, details);
  }
}