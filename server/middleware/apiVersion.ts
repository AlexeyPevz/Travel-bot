import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Supported API versions
export const API_VERSIONS = {
  v1: '1.0.0',
  v2: '2.0.0',
} as const;

export type ApiVersion = keyof typeof API_VERSIONS;

// Default version
export const DEFAULT_API_VERSION: ApiVersion = 'v1';

// Deprecation dates
export const DEPRECATION_DATES: Partial<Record<ApiVersion, Date>> = {
  // v1 will be deprecated in the future
  // v1: new Date('2025-01-01'),
};

declare global {
  namespace Express {
    interface Request {
      apiVersion?: ApiVersion;
    }
  }
}

/**
 * API Version middleware
 * Detects API version from URL path or Accept header
 */
export function apiVersionMiddleware(req: Request, res: Response, next: NextFunction) {
  let version: ApiVersion | undefined;

  // 1. Check URL path for version
  const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
  if (pathMatch) {
    version = pathMatch[1] as ApiVersion;
  }

  // 2. Check Accept header for version
  if (!version) {
    const acceptHeader = req.headers['accept'];
    if (acceptHeader && typeof acceptHeader === 'string') {
      const versionMatch = acceptHeader.match(/application\/vnd\.travelbot\.(v\d+)\+json/);
      if (versionMatch) {
        version = versionMatch[1] as ApiVersion;
      }
    }
  }

  // 3. Check X-API-Version header
  if (!version) {
    const versionHeader = req.headers['x-api-version'];
    if (versionHeader && typeof versionHeader === 'string') {
      version = versionHeader as ApiVersion;
    }
  }

  // 4. Use default version
  if (!version || !API_VERSIONS[version]) {
    version = DEFAULT_API_VERSION;
  }

  // Store version in request
  req.apiVersion = version;

  // Add version to response headers
  res.setHeader('X-API-Version', API_VERSIONS[version]);

  // Check for deprecated versions
  const deprecationDate = DEPRECATION_DATES[version];
  if (deprecationDate) {
    res.setHeader('Deprecation', deprecationDate.toISOString());
    res.setHeader('Sunset', deprecationDate.toISOString());
    
    if (new Date() > deprecationDate) {
      return res.status(410).json({
        error: 'API version deprecated',
        message: `API version ${version} is no longer supported`,
        current_version: DEFAULT_API_VERSION,
      });
    }
  }

  // Log API version usage
  logger.debug(`API request using version ${version}`, {
    path: req.path,
    method: req.method,
    correlationId: req.correlationId,
  });

  next();
}

/**
 * Create versioned route handler
 */
export function versionedRoute(
  handlers: Partial<Record<ApiVersion, (req: Request, res: Response, next: NextFunction) => any>>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const version = req.apiVersion || DEFAULT_API_VERSION;
    const handler = handlers[version];

    if (!handler) {
      return res.status(501).json({
        error: 'Not implemented',
        message: `This endpoint is not available in API version ${version}`,
        available_versions: Object.keys(handlers),
      });
    }

    return handler(req, res, next);
  };
}

/**
 * Mark route as deprecated
 */
export function deprecatedRoute(
  message: string,
  alternativeEndpoint?: string,
  removalDate?: Date
) {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Deprecation', 'true');
    
    if (removalDate) {
      res.setHeader('Sunset', removalDate.toISOString());
    }

    const warning = `299 - "${message}"`;
    if (alternativeEndpoint) {
      res.setHeader('Link', `<${alternativeEndpoint}>; rel="alternate"`);
    }
    
    res.setHeader('Warning', warning);

    logger.warn('Deprecated endpoint accessed', {
      path: req.path,
      method: req.method,
      correlationId: req.correlationId,
      message,
    });

    next();
  };
}