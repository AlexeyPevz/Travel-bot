import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ZodError } from 'zod';
import logger from '../utils/logger';
import { getCorrelationId } from './tracing';

// Development error handler
function handleDevelopmentError(err: Error, req: Request, res: Response) {
  const correlationId = req.correlationId || getCorrelationId();
  
  logger.error({
    message: err.message,
    stack: err.stack,
    correlationId,
    path: req.path,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params
  });
  
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Validation error',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        path: req.path,
        correlationId,
        details: err.errors
      }
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        statusCode: err.statusCode,
        timestamp: new Date().toISOString(),
      }
    });
  }

  // Unknown errors
  res.status(500).json({ error: { message: 'Internal server error', statusCode: 500, timestamp: new Date().toISOString() } });
}

// Production error handler
function handleProductionError(err: Error, req: Request, res: Response) {
  // Log error internally
  logger.error({
    message: err.message,
    path: req.path,
    method: req.method,
    statusCode: err instanceof AppError ? err.statusCode : 500,
    isOperational: err instanceof AppError ? err.isOperational : false
  });

  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Invalid request data',
        statusCode: 400,
        timestamp: new Date().toISOString()
      }
    });
  }

  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        statusCode: err.statusCode,
        timestamp: new Date().toISOString(),
      }
    });
  }

  // Don't leak error details in production
  res.status(500).json({
    error: {
      message: 'Something went wrong',
      statusCode: 500,
      timestamp: new Date().toISOString()
    }
  });
}

// Main error handler middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Prevent sending response if already sent
  if (res.headersSent) {
    return next(err);
  }

  if (process.env.NODE_ENV === 'development') {
    handleDevelopmentError(err, req, res);
  } else {
    handleProductionError(err, req, res);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error | any) => {
  logger.error('Unhandled Rejection:', reason);
  
  // In production, exit process
  if (process.env.NODE_ENV === 'production') {
    logger.error('Shutting down due to unhandled rejection...');
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  logger.error('Shutting down due to uncaught exception...');
  
  // Always exit on uncaught exceptions
  process.exit(1);
});