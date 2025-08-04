import { Express } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// API rate limiter (stricter)
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  message: 'Too many API requests, please try again later.'
});

// CORS configuration
const corsOptions = {
  origin: process.env.APP_URL || 'http://localhost:5000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

export function setupSecurity(app: Express) {
  // Basic security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://telegram.org"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.telegram.org"]
      }
    }
  }));

  // CORS
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && (origin.includes('localhost') || origin.includes(process.env.APP_URL || ''))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    }
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Apply rate limiting
  app.use('/api/', apiLimiter);
  app.use(limiter);
}

// Sanitize input to prevent XSS
export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    // Remove script tags and dangerous HTML
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
  
  if (Array.isArray(input)) {
    return input.map(sanitizeInput);
  }
  
  if (typeof input === 'object' && input !== null) {
    const sanitized: any = {};
    for (const key in input) {
      sanitized[key] = sanitizeInput(input[key]);
    }
    return sanitized;
  }
  
  return input;
}

// Middleware to sanitize request body
export function sanitizeBody(req: any, res: any, next: any) {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  next();
}