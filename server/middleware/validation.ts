import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import logger from '../utils/logger';

/**
 * Типы для расширения Request объекта
 */
declare global {
  namespace Express {
    interface Request {
      validated?: {
        body?: any;
        query?: any;
        params?: any;
      };
    }
  }
}

/**
 * Опции для валидации
 */
interface ValidationOptions {
  /**
   * Режим валидации: 'strict' отклоняет лишние поля, 'strip' удаляет их
   */
  mode?: 'strict' | 'strip';
  
  /**
   * Кастомная функция для форматирования ошибок
   */
  errorFormatter?: (error: z.ZodError) => any;
  
  /**
   * Статус код для ошибок валидации
   */
  statusCode?: number;
}

/**
 * Форматирует ошибки валидации в читаемый формат
 */
function formatValidationError(error: z.ZodError): {
  message: string;
  errors: Array<{
    path: string;
    message: string;
    code: string;
  }>;
} {
  const validationError = fromZodError(error, {
    prefix: 'Validation failed',
    prefixSeparator: ': ',
    issueSeparator: '; '
  });

  return {
    message: validationError.message,
    errors: error.errors.map(err => ({
      path: err.path.join('.'),
      message: err.message,
      code: err.code
    }))
  };
}

/**
 * Middleware для валидации тела запроса
 */
export function validateBody<T>(
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
) {
  const {
    mode = 'strip',
    errorFormatter = formatValidationError,
    statusCode = 400
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseMethod = mode === 'strict' ? 'parse' : 'parseAsync';
      const validated = await schema[parseMethod](req.body);
      
      // Сохраняем валидированные данные
      req.body = validated;
      if (!req.validated) req.validated = {};
      req.validated.body = validated;
      
      logger.debug('Body validation passed', {
        path: req.path,
        method: req.method
      });
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Body validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors
        });
        
        return res.status(statusCode).json({
          error: 'Validation Error',
          details: errorFormatter(error)
        });
      }
      
      logger.error('Unexpected error in body validation', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during validation'
      });
    }
  };
}

/**
 * Middleware для валидации query параметров
 */
export function validateQuery<T>(
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
) {
  const {
    mode = 'strip',
    errorFormatter = formatValidationError,
    statusCode = 400
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Query параметры всегда приходят как строки, преобразуем их
      const transformedQuery = transformQueryParams(req.query);
      
      const parseMethod = mode === 'strict' ? 'parse' : 'parseAsync';
      const validated = await schema[parseMethod](transformedQuery);
      
      // Сохраняем валидированные данные
      req.query = validated as any;
      if (!req.validated) req.validated = {};
      req.validated.query = validated;
      
      logger.debug('Query validation passed', {
        path: req.path,
        method: req.method
      });
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Query validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors
        });
        
        return res.status(statusCode).json({
          error: 'Validation Error',
          details: errorFormatter(error)
        });
      }
      
      logger.error('Unexpected error in query validation', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during validation'
      });
    }
  };
}

/**
 * Middleware для валидации параметров пути
 */
export function validateParams<T>(
  schema: z.ZodSchema<T>,
  options: ValidationOptions = {}
) {
  const {
    mode = 'strip',
    errorFormatter = formatValidationError,
    statusCode = 400
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parseMethod = mode === 'strict' ? 'parse' : 'parseAsync';
      const validated = await schema[parseMethod](req.params);
      
      // Сохраняем валидированные данные
      req.params = validated as any;
      if (!req.validated) req.validated = {};
      req.validated.params = validated;
      
      logger.debug('Params validation passed', {
        path: req.path,
        method: req.method
      });
      
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        logger.warn('Params validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors
        });
        
        return res.status(statusCode).json({
          error: 'Validation Error',
          details: errorFormatter(error)
        });
      }
      
      logger.error('Unexpected error in params validation', error);
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred during validation'
      });
    }
  };
}

/**
 * Комбинированный middleware для валидации всех частей запроса
 */
interface ValidateAllOptions extends ValidationOptions {
  body?: z.ZodSchema<any>;
  query?: z.ZodSchema<any>;
  params?: z.ZodSchema<any>;
}

export function validateAll(options: ValidateAllOptions) {
  const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];
  
  if (options.body) {
    middlewares.push(validateBody(options.body, options));
  }
  
  if (options.query) {
    middlewares.push(validateQuery(options.query, options));
  }
  
  if (options.params) {
    middlewares.push(validateParams(options.params, options));
  }
  
  return (req: Request, res: Response, next: NextFunction) => {
    // Выполняем middleware последовательно
    let index = 0;
    
    const runNext = (err?: any) => {
      if (err) return next(err);
      
      if (index >= middlewares.length) {
        return next();
      }
      
      const middleware = middlewares[index++];
      middleware(req, res, runNext);
    };
    
    runNext();
  };
}

/**
 * Преобразует query параметры из строк в правильные типы
 */
function transformQueryParams(query: any): any {
  const transformed: any = {};
  
  for (const [key, value] of Object.entries(query)) {
    if (typeof value !== 'string') {
      transformed[key] = value;
      continue;
    }
    
    // Пытаемся преобразовать в число
    if (/^\d+$/.test(value)) {
      transformed[key] = parseInt(value, 10);
    } else if (/^\d+\.\d+$/.test(value)) {
      transformed[key] = parseFloat(value);
    }
    // Пытаемся преобразовать в булево значение
    else if (value === 'true') {
      transformed[key] = true;
    } else if (value === 'false') {
      transformed[key] = false;
    }
    // Пытаемся преобразовать в массив (comma-separated)
    else if (value.includes(',')) {
      transformed[key] = value.split(',').map(v => v.trim());
    }
    // Оставляем как строку
    else {
      transformed[key] = value;
    }
  }
  
  return transformed;
}

/**
 * Создает безопасный обработчик с автоматической валидацией
 */
export function createValidatedHandler<TBody = any, TQuery = any, TParams = any>(
  options: {
    body?: z.ZodSchema<TBody>;
    query?: z.ZodSchema<TQuery>;
    params?: z.ZodSchema<TParams>;
  },
  handler: (
    req: Request & {
      body: TBody;
      query: TQuery;
      params: TParams;
    },
    res: Response,
    next: NextFunction
  ) => Promise<void> | void
) {
  const middleware = validateAll(options);
  
  return async (req: Request, res: Response, next: NextFunction) => {
    middleware(req, res, async (err) => {
      if (err) return next(err);
      
      try {
        await handler(req as any, res, next);
      } catch (error) {
        next(error);
      }
    });
  };
}

/**
 * Экспортируем типы для использования в других модулях
 */
export type ValidatedRequest<TBody = any, TQuery = any, TParams = any> = Request & {
  body: TBody;
  query: TQuery;
  params: TParams;
  validated: {
    body: TBody;
    query: TQuery;
    params: TParams;
  };
};