export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict') {
    super(message, 409);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429);
  }
}

// Async error handler wrapper
export const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Error response interface
interface ErrorResponse {
  error: {
    message: string;
    statusCode: number;
    timestamp: string;
    path?: string;
    details?: any;
  };
}

// Send error response
export function sendErrorResponse(
  res: any,
  error: AppError | Error,
  statusCode?: number
): void {
  const code = statusCode || (error instanceof AppError ? error.statusCode : 500);
  const message = error.message || 'Internal Server Error';
  
  const errorResponse: ErrorResponse = {
    error: {
      message,
      statusCode: code,
      timestamp: new Date().toISOString()
    }
  };

  // In development, include stack trace
  if (process.env.NODE_ENV === 'development' && error.stack) {
    errorResponse.error.details = {
      stack: error.stack.split('\n')
    };
  }

  res.status(code).json(errorResponse);
}