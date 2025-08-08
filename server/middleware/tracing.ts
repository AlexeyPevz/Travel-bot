import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { createNamespace, getNamespace } from 'cls-hooked';
import logger from '../utils/logger';

// Create namespace for request context
const requestContext = createNamespace('request-context');

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

export interface RequestContext {
  correlationId: string;
  userId?: string;
  method: string;
  path: string;
  ip: string;
  userAgent?: string;
}

/**
 * Middleware to add correlation ID to requests
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get or generate correlation ID
  const correlationId = 
    req.headers['x-correlation-id'] as string ||
    req.headers['x-request-id'] as string ||
    uuidv4();

  // Store in request
  req.correlationId = correlationId;
  req.startTime = Date.now();

  // Set response header
  res.setHeader('X-Correlation-Id', correlationId);

  // Run in request context
  requestContext.run(() => {
    // Store context data
    requestContext.set('correlationId', correlationId);
    requestContext.set('method', req.method);
    requestContext.set('path', req.path);
    requestContext.set('ip', req.ip || req.socket.remoteAddress);
    requestContext.set('userAgent', req.headers['user-agent']);
    
    // Log request start
    logger.info({
      message: 'Request started',
      correlationId,
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    // Handle response finish
    const originalEnd = res.end;
    res.end = function(chunk?: any, encoding?: any, cb?: any) {
      // Log request completion
      const duration = Date.now() - (req.startTime || 0);
      logger.info({
        message: 'Request completed',
        correlationId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      });

      // Call original end with proper signature
      return (originalEnd as any).call(res, chunk, encoding, cb);
    } as any;

    next();
  });
}

/**
 * Get current request context
 */
export function getRequestContext(): RequestContext | null {
  const context = getNamespace('request-context');
  if (!context || !context.active) {
    return null;
  }

  return {
    correlationId: context.get('correlationId'),
    userId: context.get('userId'),
    method: context.get('method'),
    path: context.get('path'),
    ip: context.get('ip'),
    userAgent: context.get('userAgent'),
  };
}

/**
 * Get current correlation ID
 */
export function getCorrelationId(): string | null {
  const context = getRequestContext();
  return context?.correlationId || null;
}

/**
 * Set user ID in request context
 */
export function setUserId(userId: string) {
  const context = getNamespace('request-context');
  if (context && context.active) {
    context.set('userId', userId);
  }
}

/**
 * Create child logger with correlation ID
 */
export function createRequestLogger() {
  const correlationId = getCorrelationId();
  if (!correlationId) {
    return logger;
  }

  return logger.child({ correlationId });
}

/**
 * Wrap async function with request context
 */
export function withRequestContext<T extends (...args: any[]) => Promise<any>>(
  fn: T
): T {
  return (async (...args: any[]) => {
    const context = getNamespace('request-context');
    if (!context || !context.active) {
      return fn(...args);
    }

    return new Promise((resolve, reject) => {
      context.run(() => {
        fn(...args).then(resolve).catch(reject);
      });
    });
  }) as T;
}

/**
 * Express middleware to trace async errors with correlation ID
 */
export function asyncTraceHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      const correlationId = req.correlationId || getCorrelationId();
      logger.error({
        message: 'Async handler error',
        correlationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        method: req.method,
        path: req.path,
      });
      next(error);
    }
  };
}