import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import logger from '../utils/logger';

// Request context type
export interface RequestContext {
  correlationId: string;
  userId?: string;
  method: string;
  path: string;
  ip: string;
  userAgent?: string;
}

// Async local storage for request context
const als = new AsyncLocalStorage<RequestContext>();

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
      startTime?: number;
    }
  }
}

/**
 * Middleware to add correlation ID to requests
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  // Get or generate correlation ID
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    (req.headers['x-request-id'] as string) ||
    randomUUID();

  // Store in request
  req.correlationId = correlationId;
  req.startTime = Date.now();

  // Set response header
  res.setHeader('X-Correlation-Id', correlationId);

  const context: RequestContext = {
    correlationId,
    method: req.method,
    path: req.path,
    ip: (req.ip || (req.socket as any)?.remoteAddress || '').toString(),
    userAgent: req.headers['user-agent'],
  };

  als.run(context, () => {
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
    res.end = function (chunk?: any, encoding?: any, cb?: any) {
      const duration = Date.now() - (req.startTime || 0);
      logger.info({
        message: 'Request completed',
        correlationId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
      });
      return (originalEnd as any).call(res, chunk, encoding, cb);
    } as any;

    next();
  });
}

/**
 * Get current request context
 */
export function getRequestContext(): RequestContext | null {
  return als.getStore() || null;
}

/**
 * Get current correlation ID
 */
export function getCorrelationId(): string | null {
  const ctx = getRequestContext();
  return ctx?.correlationId || null;
}

/**
 * Set user ID in request context
 */
export function setUserId(userId: string) {
  const ctx = als.getStore();
  if (ctx) {
    // mutate in place; ALS holds the same object reference
    (ctx as any).userId = userId;
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
    const ctx = als.getStore();
    if (!ctx) return fn(...args);
    return await fn(...args);
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