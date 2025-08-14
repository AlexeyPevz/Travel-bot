import { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { doubleCsrf } from 'csrf-csrf';
import crypto from 'crypto';

// Rate limiting перенесён в `dynamicRateLimiter` (см. server/middleware/rateLimiter.ts)

// CSRF Protection configuration
const getSecret = () => process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
const { doubleCsrfProtection, generateToken } = doubleCsrf({
  getSecret,
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600000, // 1 hour
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getCsrfTokenFromRequest: (req: Request) => (req.headers['x-csrf-token'] as string) || '',
  getSessionIdentifier: (req: Request) => (req as any).session?.id || (req as any).sessionID || req.ip,
});

// CORS configuration
const corsOptions = {
  origin: process.env.APP_URL || 'http://localhost:5000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
};

export function setupSecurity(app: Express) {
  const csrfDisabled = process.env.DISABLE_CSRF === 'true';
  // Trust proxy - required for rate limiting and secure cookies behind reverse proxy
  app.set('trust proxy', 1);

  // Cookie parser - required for session and CSRF
  app.use(cookieParser(process.env.COOKIE_SECRET || crypto.randomBytes(32).toString('hex')));

  // Session configuration
  app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'strict',
    },
    name: 'sessionId',
  }));

  // Basic security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://telegram.org"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.telegram.org"],
        fontSrc: ["'self'", "https:", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'", "https://telegram.org"],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));

  // CORS
  app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    const appUrl = process.env.APP_URL || '';
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5000',
      appUrl
    ].filter(Boolean);

    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
    }
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // Rate limiting is configured separately in dynamicRateLimiter

  // CSRF protection for non-API routes (can be disabled via DISABLE_CSRF=true)
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/telegram') || req.path.startsWith('/api/webhook')) {
      return next();
    }

    // Для чистого JSON API под JWT можно отключить CSRF
    if (req.path.startsWith('/api')) {
      return next();
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }
    if (csrfDisabled) {
      return next();
    }
    return doubleCsrfProtection(req, res, next);
  });

  // CSRF token endpoint
  app.get('/api/csrf-token', (req: Request, res: Response) => {
    if (csrfDisabled) {
      const token = crypto.randomBytes(32).toString('hex');
      // Optionally set a non-HTTPOnly cookie for client debugging (not required)
      res.cookie('x-csrf-token', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 3600000,
        domain: process.env.COOKIE_DOMAIN || undefined,
      });
      return res.json({ csrfToken: token });
    }
    try {
      // Fallback path if library provides generateToken
      // @ts-ignore
      const token = (generateToken as any)?.(req, res);
      if (!token) {
        // As a fallback, emit a random token (library will still validate unsafe methods)
        const rnd = crypto.randomBytes(32).toString('hex');
        return res.json({ csrfToken: rnd });
      }
      return res.json({ csrfToken: token });
    } catch {
      return res.status(500).json({ error: { message: 'Failed to issue CSRF token' } });
    }
  });

  // Security headers for API responses
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    next();
  });
}

export function sanitizeInput(input: any): any {
  if (typeof input === 'string') {
    return input
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
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

export function sanitizeBody(req: any, res: any, next: any) {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  next();
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function hashData(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}