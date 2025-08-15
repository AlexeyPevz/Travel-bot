import { register, collectDefaultMetrics, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { Express, Request, Response } from 'express';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({
  prefix: 'travelbot_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// HTTP Metrics
export const httpRequestDuration = new Histogram({
  name: 'travelbot_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

export const httpRequestTotal = new Counter({
  name: 'travelbot_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status', 'status_code'],
});

export const httpRequestSize = new Summary({
  name: 'travelbot_http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

export const httpResponseSize = new Summary({
  name: 'travelbot_http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

export const activeConnections = new Gauge({
  name: 'travelbot_active_connections',
  help: 'Number of active connections',
});

// Bot Metrics
export const botMessagesTotal = new Counter({
  name: 'travelbot_bot_messages_total',
  help: 'Total number of bot messages processed',
  labelNames: ['type', 'command', 'status', 'chat_type'],
});

export const botCommandDuration = new Histogram({
  name: 'travelbot_bot_command_duration_seconds',
  help: 'Duration of bot command processing',
  labelNames: ['command', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export const botActiveChats = new Gauge({
  name: 'travelbot_bot_active_chats',
  help: 'Number of active bot chats',
  labelNames: ['type'], // private, group, supergroup
});

export const botCallbackQueries = new Counter({
  name: 'travelbot_bot_callback_queries_total',
  help: 'Total number of callback queries',
  labelNames: ['action', 'status'],
});

// Tour Search Metrics
export const tourSearchDuration = new Histogram({
  name: 'travelbot_tour_search_duration_seconds',
  help: 'Duration of tour searches in seconds',
  labelNames: ['destination', 'provider', 'status'],
  buckets: [0.5, 1, 2, 3, 5, 10, 20, 30],
});

export const tourSearchTotal = new Counter({
  name: 'travelbot_tour_searches_total',
  help: 'Total number of tour searches',
  labelNames: ['destination', 'provider', 'status'],
});

export const tourSearchResults = new Histogram({
  name: 'travelbot_tour_search_results_count',
  help: 'Number of results returned by tour searches',
  labelNames: ['destination', 'provider'],
  buckets: [0, 1, 5, 10, 20, 50, 100, 200, 500],
});

// AI Metrics
export const aiRequestDuration = new Histogram({
  name: 'travelbot_ai_request_duration_seconds',
  help: 'Duration of AI API requests',
  labelNames: ['provider', 'model', 'operation', 'status'],
  buckets: [0.5, 1, 2, 5, 10, 20, 30, 60],
});

export const aiRequestTotal = new Counter({
  name: 'travelbot_ai_requests_total',
  help: 'Total number of AI API requests',
  labelNames: ['provider', 'model', 'operation', 'status'],
});

export const aiTokensUsed = new Counter({
  name: 'travelbot_ai_tokens_used_total',
  help: 'Total number of AI tokens used',
  labelNames: ['provider', 'model', 'type'], // type: prompt, completion
});

export const aiFallbackAttempts = new Counter({
  name: 'travelbot_ai_fallback_attempts_total',
  help: 'Number of AI fallback attempts',
  labelNames: ['from_provider', 'to_provider', 'reason'],
});

// Cache Metrics
export const cacheHitRate = new Summary({
  name: 'travelbot_cache_hit_rate',
  help: 'Cache hit rate',
  labelNames: ['operation', 'cache_type'], // cache_type: redis, memory
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

export const cacheOperationDuration = new Histogram({
  name: 'travelbot_cache_operation_duration_seconds',
  help: 'Duration of cache operations',
  labelNames: ['operation', 'cache_type', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
});

export const cacheSize = new Gauge({
  name: 'travelbot_cache_size_bytes',
  help: 'Current cache size in bytes',
  labelNames: ['cache_type'],
});

// Queue Metrics
export const queueJobsTotal = new Counter({
  name: 'travelbot_queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'job_type', 'status'],
});

export const queueJobDuration = new Histogram({
  name: 'travelbot_queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue', 'job_type', 'status'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
});

export const queueSize = new Gauge({
  name: 'travelbot_queue_size',
  help: 'Current queue size',
  labelNames: ['queue', 'state'], // state: waiting, active, delayed, failed
});

export const queueJobRetries = new Counter({
  name: 'travelbot_queue_job_retries_total',
  help: 'Total number of job retries',
  labelNames: ['queue', 'job_type'],
});

// User Metrics
export const activeUsers = new Gauge({
  name: 'travelbot_active_users',
  help: 'Number of active users',
  labelNames: ['time_range'], // daily, weekly, monthly
});

export const userRegistrations = new Counter({
  name: 'travelbot_user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['source'], // telegram, web, referral
});

export const userSessions = new Gauge({
  name: 'travelbot_user_sessions_active',
  help: 'Number of active user sessions',
  labelNames: ['type'], // web, bot
});

// Business Metrics
export const activeTravelRequests = new Gauge({
  name: 'travelbot_active_travel_requests',
  help: 'Number of active travel requests being monitored',
  labelNames: ['status'], // monitoring, expired, matched
});

export const bookingsTotal = new Counter({
  name: 'travelbot_bookings_total',
  help: 'Total number of bookings',
  labelNames: ['status', 'destination'],
});

export const referralsTotal = new Counter({
  name: 'travelbot_referrals_total',
  help: 'Total number of referrals',
  labelNames: ['status'], // pending, completed, expired
});

// Database Metrics
export const dbQueryDuration = new Histogram({
  name: 'travelbot_db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table', 'status'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
});

export const dbConnectionPool = new Gauge({
  name: 'travelbot_db_connection_pool',
  help: 'Database connection pool metrics',
  labelNames: ['state'], // active, idle, waiting
});

export const dbTransactionDuration = new Histogram({
  name: 'travelbot_db_transaction_duration_seconds',
  help: 'Database transaction duration',
  labelNames: ['status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10],
});

// External API Metrics
export const externalApiDuration = new Histogram({
  name: 'travelbot_external_api_duration_seconds',
  help: 'External API call duration',
  labelNames: ['api', 'endpoint', 'method', 'status', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60],
});

export const externalApiTotal = new Counter({
  name: 'travelbot_external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['api', 'endpoint', 'method', 'status', 'status_code'],
});

export const externalApiRateLimit = new Gauge({
  name: 'travelbot_external_api_rate_limit',
  help: 'External API rate limit status',
  labelNames: ['api', 'type'], // type: remaining, limit, reset_time
});

// Error Metrics
export const errorRate = new Counter({
  name: 'travelbot_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code', 'source', 'severity'],
});

export const unhandledExceptions = new Counter({
  name: 'travelbot_unhandled_exceptions_total',
  help: 'Total number of unhandled exceptions',
  labelNames: ['type'],
});

// Rate Limit Metrics
export const rateLimitHits = new Counter({
  name: 'travelbot_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'user_type'],
});

export const rateLimitRemaining = new Gauge({
  name: 'travelbot_rate_limit_remaining',
  help: 'Remaining rate limit for users',
  labelNames: ['endpoint', 'user_id'],
});

// JWT Metrics
export const jwtTokensIssued = new Counter({
  name: 'travelbot_jwt_tokens_issued_total',
  help: 'Total number of JWT tokens issued',
  labelNames: ['type'], // access, refresh
});

export const jwtTokensRefreshed = new Counter({
  name: 'travelbot_jwt_tokens_refreshed_total',
  help: 'Total number of JWT tokens refreshed',
  labelNames: ['status'],
});

export const jwtTokensRevoked = new Counter({
  name: 'travelbot_jwt_tokens_revoked_total',
  help: 'Total number of JWT tokens revoked',
  labelNames: ['reason'], // logout, security, expired
});

// Middleware to track HTTP metrics
export function metricsMiddleware(req: Request, res: Response, next: any) {
  const start = Date.now();
  
  // Track active connections
  activeConnections.inc();
  
  // Track request size
  if (req.headers['content-length']) {
    httpRequestSize.observe(
      { method: req.method, route: req.route?.path || req.path },
      parseInt(req.headers['content-length'])
    );
  }
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const labels = {
      method: req.method,
      route: route,
      status: res.statusCode < 400 ? 'success' : 'error',
      status_code: res.statusCode.toString(),
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
    activeConnections.dec();
    
    // Track response size
    if (res.getHeader('content-length')) {
      httpResponseSize.observe(
        { method: req.method, route: route },
        parseInt(res.getHeader('content-length') as string)
      );
    }
  });
  
  next();
}

function metricsAuthGuard(req: Request): boolean {
  // IP allowlist
  const allowlist = (process.env.METRICS_IP_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean);
  if (allowlist.length > 0 && req.ip && !allowlist.includes(req.ip)) {
    return false;
  }
  // Basic Auth
  const basic = process.env.METRICS_BASIC_AUTH; // format: user:pass
  if (!basic) return true;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const token = header.slice(6);
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    return decoded === basic;
  } catch {
    return false;
  }
}

// Setup metrics endpoint
export function setupMetrics(app: Express) {
  // Add metrics middleware
  app.use(metricsMiddleware);
  
  // Metrics endpoint
  app.get('/metrics', (req, res) => {
    if (process.env.NODE_ENV === 'production' && !metricsAuthGuard(req)) {
      return res.status(401).set('WWW-Authenticate', 'Basic realm="metrics"').end('Unauthorized');
    }
    res.set('Content-Type', register.contentType);
    register.metrics().then(metrics => {
      res.end(metrics);
    }).catch(err => {
      res.status(500).end(err.message);
    });
  });
}

// Helper function to track async operations
export async function trackAsyncOperation<T>(
  histogram: Histogram<string>,
  labels: Record<string, string>,
  operation: () => Promise<T>
): Promise<T> {
  const timer = histogram.startTimer(labels);
  try {
    const result = await operation();
    timer({ ...labels, status: 'success' });
    return result;
  } catch (error) {
    timer({ ...labels, status: 'error' });
    throw error;
  }
}

// Track cache operations
export function trackCacheHit(operation: string, hit: boolean, cacheType: string = 'redis') {
  cacheHitRate.observe({ operation, cache_type: cacheType }, hit ? 1 : 0);
}

// Track errors
export function trackError(type: string, code: string, source: string, severity: string = 'error') {
  errorRate.inc({ type, code, source, severity });
}

// Track bot command
export function trackBotCommand(command: string, chatType: string, success: boolean) {
  botMessagesTotal.inc({
    type: 'command',
    command,
    status: success ? 'success' : 'error',
    chat_type: chatType
  });
}

// Track AI request
export function trackAIRequest(provider: string, model: string, operation: string, success: boolean, tokens?: { prompt: number, completion: number }) {
  aiRequestTotal.inc({
    provider,
    model,
    operation,
    status: success ? 'success' : 'error'
  });
  
  if (tokens) {
    aiTokensUsed.inc({ provider, model, type: 'prompt' }, tokens.prompt);
    aiTokensUsed.inc({ provider, model, type: 'completion' }, tokens.completion);
  }
}

// Export all metrics for external use
export const metrics = {
  // HTTP
  httpRequestDuration,
  httpRequestTotal,
  httpRequestSize,
  httpResponseSize,
  activeConnections,
  
  // Bot
  botMessagesTotal,
  botCommandDuration,
  botActiveChats,
  botCallbackQueries,
  
  // Tour Search
  tourSearchDuration,
  tourSearchTotal,
  tourSearchResults,
  
  // AI
  aiRequestDuration,
  aiRequestTotal,
  aiTokensUsed,
  aiFallbackAttempts,
  
  // Cache
  cacheHitRate,
  cacheOperationDuration,
  cacheSize,
  
  // Queue
  queueJobsTotal,
  queueJobDuration,
  queueSize,
  queueJobRetries,
  
  // User
  activeUsers,
  userRegistrations,
  userSessions,
  
  // Business
  activeTravelRequests,
  bookingsTotal,
  referralsTotal,
  
  // Database
  dbQueryDuration,
  dbConnectionPool,
  dbTransactionDuration,
  
  // External API
  externalApiDuration,
  externalApiTotal,
  externalApiRateLimit,
  
  // Errors
  errorRate,
  unhandledExceptions,
  
  // Rate Limit
  rateLimitHits,
  rateLimitRemaining,
  
  // JWT
  jwtTokensIssued,
  jwtTokensRefreshed,
  jwtTokensRevoked,
};