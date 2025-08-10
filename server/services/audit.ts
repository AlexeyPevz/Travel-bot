import { db } from '../../db';
import { sql } from 'drizzle-orm';
import logger from '../utils/logger';
import { Request } from 'express';

// Audit log table schema (to be added to schema.ts)
export interface AuditLog {
  id: number;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  requestMethod: string;
  requestPath: string;
  requestBody: any;
  responseStatus: number | null;
  errorMessage: string | null;
  metadata: any;
  createdAt: Date;
}

// Audit action types
export enum AuditAction {
  // Authentication
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILED = 'LOGIN_FAILED',
  LOGOUT = 'LOGOUT',
  TOKEN_REFRESH = 'TOKEN_REFRESH',
  
  // Profile
  PROFILE_VIEW = 'PROFILE_VIEW',
  PROFILE_CREATE = 'PROFILE_CREATE',
  PROFILE_UPDATE = 'PROFILE_UPDATE',
  PROFILE_DELETE = 'PROFILE_DELETE',
  
  // Tours
  TOUR_SEARCH = 'TOUR_SEARCH',
  TOUR_VIEW = 'TOUR_VIEW',
  TOUR_BOOK = 'TOUR_BOOK',
  TOUR_VOTE = 'TOUR_VOTE',
  
  // Groups
  GROUP_CREATE = 'GROUP_CREATE',
  GROUP_JOIN = 'GROUP_JOIN',
  GROUP_LEAVE = 'GROUP_LEAVE',
  GROUP_DELETE = 'GROUP_DELETE',
  
  // Admin
  ADMIN_ACCESS = 'ADMIN_ACCESS',
  CONFIG_UPDATE = 'CONFIG_UPDATE',
  USER_BAN = 'USER_BAN',
  
  // Security
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  CSRF_VIOLATION = 'CSRF_VIOLATION'
}

/**
 * Log an audit event
 */
export async function logAudit(params: {
  userId?: string | null;
  action: AuditAction | string;
  resource: string;
  resourceId?: string | null;
  request?: Request;
  responseStatus?: number;
  errorMessage?: string | null;
  metadata?: any;
}): Promise<void> {
  try {
    const {
      userId = null,
      action,
      resource,
      resourceId = null,
      request,
      responseStatus = null,
      errorMessage = null,
      metadata = {}
    } = params;

    // Extract request info
    const ipAddress = request ? getClientIp(request) : null;
    const userAgent = request?.get('user-agent') || null;
    const requestMethod = request?.method || 'UNKNOWN';
    const requestPath = request?.path || 'UNKNOWN';
    
    // Sanitize request body (remove sensitive data)
    const requestBody = request?.body ? sanitizeRequestBody(request.body) : null;

    // Create audit log entry
    await db.execute(sql`
      INSERT INTO audit_logs (
        user_id,
        action,
        resource,
        resource_id,
        ip_address,
        user_agent,
        request_method,
        request_path,
        request_body,
        response_status,
        error_message,
        metadata,
        created_at
      ) VALUES (
        ${userId},
        ${action},
        ${resource},
        ${resourceId},
        ${ipAddress},
        ${userAgent},
        ${requestMethod},
        ${requestPath},
        ${requestBody ? JSON.stringify(requestBody) : null}::jsonb,
        ${responseStatus},
        ${errorMessage},
        ${metadata ? JSON.stringify(metadata) : null}::jsonb,
        NOW()
      )
    `);

    // Log security-related events
    if (isSecurityEvent(action)) {
      logger.warn('Security audit event', {
        action,
        userId,
        ipAddress,
        resource,
        errorMessage
      });
    }
  } catch (error) {
    logger.error('Failed to log audit event', { error, params });
  }
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string {
  // Check various headers for real IP
  const forwarded = req.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  return req.get('x-real-ip') || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress || 
         'unknown';
}

/**
 * Sanitize request body to remove sensitive data
 */
function sanitizeRequestBody(body: any): any {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = [
    'password',
    'token',
    'secret',
    'apiKey',
    'creditCard',
    'cvv',
    'ssn',
    'refreshToken',
    'accessToken'
  ];

  // Recursively sanitize object
  function sanitize(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    
    if (obj && typeof obj === 'object') {
      const result: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Check if field contains sensitive data
        if (sensitiveFields.some(field => lowerKey.includes(field))) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          result[key] = sanitize(value);
        } else {
          result[key] = value;
        }
      }
      
      return result;
    }
    
    return obj;
  }

  return sanitize(sanitized);
}

/**
 * Check if action is security-related
 */
function isSecurityEvent(action: string): boolean {
  const securityActions = [
    AuditAction.LOGIN_FAILED,
    AuditAction.SUSPICIOUS_ACTIVITY,
    AuditAction.RATE_LIMIT_EXCEEDED,
    AuditAction.INVALID_TOKEN,
    AuditAction.CSRF_VIOLATION,
    AuditAction.USER_BAN
  ];
  
  return securityActions.includes(action as AuditAction);
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters: {
  userId?: string;
  action?: string;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<AuditLog[]> {
  const {
    userId,
    action,
    resource,
    startDate,
    endDate,
    limit = 100,
    offset = 0
  } = filters;

  let query = sql`
    SELECT * FROM audit_logs
    WHERE 1=1
  `;

  if (userId) {
    query = sql`${query} AND user_id = ${userId}`;
  }
  if (action) {
    query = sql`${query} AND action = ${action}`;
  }
  if (resource) {
    query = sql`${query} AND resource = ${resource}`;
  }
  if (startDate) {
    query = sql`${query} AND created_at >= ${startDate}`;
  }
  if (endDate) {
    query = sql`${query} AND created_at <= ${endDate}`;
  }

  query = sql`${query} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`;

  const result = await db.execute(query);
  return result.rows as AuditLog[];
}

/**
 * Get security events summary
 */
export async function getSecuritySummary(days: number = 7): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  topIpAddresses: Array<{ ip: string; count: number }>;
  failedLogins: number;
}> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const securityEvents = await db.execute(sql`
    SELECT 
      COUNT(*) as total,
      action,
      COUNT(*) as count
    FROM audit_logs
    WHERE created_at >= ${startDate}
      AND action IN (
        ${AuditAction.LOGIN_FAILED},
        ${AuditAction.SUSPICIOUS_ACTIVITY},
        ${AuditAction.RATE_LIMIT_EXCEEDED},
        ${AuditAction.INVALID_TOKEN},
        ${AuditAction.CSRF_VIOLATION}
      )
    GROUP BY action
  `);

  const ipAddresses = await db.execute(sql`
    SELECT 
      ip_address,
      COUNT(*) as count
    FROM audit_logs
    WHERE created_at >= ${startDate}
      AND action = ${AuditAction.LOGIN_FAILED}
      AND ip_address IS NOT NULL
    GROUP BY ip_address
    ORDER BY count DESC
    LIMIT 10
  `);

  const failedLogins = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM audit_logs
    WHERE created_at >= ${startDate}
      AND action = ${AuditAction.LOGIN_FAILED}
  `);

  const eventsByType: Record<string, number> = {};
  let totalEvents = 0;

  securityEvents.rows.forEach((row: any) => {
    eventsByType[row.action] = parseInt(row.count);
    totalEvents += parseInt(row.count);
  });

  return {
    totalEvents,
    eventsByType,
    topIpAddresses: ipAddresses.rows.map((row: any) => ({
      ip: row.ip_address,
      count: parseInt(row.count)
    })),
    failedLogins: parseInt(failedLogins.rows[0]?.count || 0)
  };
}

/**
 * Middleware to automatically log API requests
 */
export function auditMiddleware(action: AuditAction | string, resource: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    
    // Capture response status
    const originalSend = res.send;
    res.send = function(data) {
      res.locals.responseData = data;
      return originalSend.call(this, data);
    };

    // Continue with request
    res.on('finish', async () => {
      const duration = Date.now() - startTime;
      
      await logAudit({
        userId: (req as any).user?.id,
        action,
        resource,
        resourceId: req.params.id || null,
        request: req,
        responseStatus: res.statusCode,
        errorMessage: res.statusCode >= 400 ? res.locals.errorMessage : null,
        metadata: {
          duration,
          method: req.method,
          path: req.path,
          query: req.query
        }
      });
    });

    next();
  };
}