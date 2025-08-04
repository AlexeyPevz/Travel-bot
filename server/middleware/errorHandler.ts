import { Request, Response, NextFunction } from 'express';
import { AppError, sendErrorResponse } from '../utils/errors';
import { ZodError } from 'zod';

// Development error handler
function handleDevelopmentError(err: Error, req: Request, res: Response) {
  console.error('Error:', err);
  
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Validation error',
        statusCode: 400,
        timestamp: new Date().toISOString(),
        path: req.path,
        details: err.errors
      }
    });
  }

  if (err instanceof AppError) {
    return sendErrorResponse(res, err);
  }

  // Unknown errors
  sendErrorResponse(res, err, 500);
}

// Production error handler
function handleProductionError(err: Error, req: Request, res: Response) {
  // Log error internally
  console.error(`Error on ${req.method} ${req.path}:`, err.message);

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
    return sendErrorResponse(res, err);
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
  console.error('Unhandled Rejection:', reason);
  
  // In production, exit process
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
  
  // Always exit on uncaught exceptions
  process.exit(1);
});