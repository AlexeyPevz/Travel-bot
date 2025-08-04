import { register, collectDefaultMetrics, Counter, Histogram, Gauge, Summary } from 'prom-client';
import { Express, Request, Response } from 'express';

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({
  prefix: 'travelbot_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Custom metrics
export const httpRequestDuration = new Histogram({
  name: 'travelbot_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
});

export const httpRequestTotal = new Counter({
  name: 'travelbot_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
});

export const activeConnections = new Gauge({
  name: 'travelbot_active_connections',
  help: 'Number of active connections',
});

export const botMessagesTotal = new Counter({
  name: 'travelbot_bot_messages_total',
  help: 'Total number of bot messages processed',
  labelNames: ['type', 'status'],
});

export const tourSearchDuration = new Histogram({
  name: 'travelbot_tour_search_duration_seconds',
  help: 'Duration of tour searches in seconds',
  labelNames: ['destination', 'status'],
  buckets: [0.5, 1, 2, 3, 5, 10, 20, 30],
});

export const tourSearchTotal = new Counter({
  name: 'travelbot_tour_searches_total',
  help: 'Total number of tour searches',
  labelNames: ['destination', 'status'],
});

export const cacheHitRate = new Summary({
  name: 'travelbot_cache_hit_rate',
  help: 'Cache hit rate',
  labelNames: ['operation'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
});

export const queueJobsTotal = new Counter({
  name: 'travelbot_queue_jobs_total',
  help: 'Total number of queue jobs',
  labelNames: ['queue', 'status'],
});

export const queueJobDuration = new Histogram({
  name: 'travelbot_queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue', 'status'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120],
});

export const activeUsers = new Gauge({
  name: 'travelbot_active_users',
  help: 'Number of active users',
});

export const activeTravelRequests = new Gauge({
  name: 'travelbot_active_travel_requests',
  help: 'Number of active travel requests being monitored',
});

export const dbQueryDuration = new Histogram({
  name: 'travelbot_db_query_duration_seconds',
  help: 'Database query duration',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
});

export const externalApiDuration = new Histogram({
  name: 'travelbot_external_api_duration_seconds',
  help: 'External API call duration',
  labelNames: ['api', 'endpoint', 'status'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30],
});

export const errorRate = new Counter({
  name: 'travelbot_errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'code', 'source'],
});

// Middleware to track HTTP metrics
export function metricsMiddleware(req: Request, res: Response, next: any) {
  const start = Date.now();
  
  // Track active connections
  activeConnections.inc();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    const labels = {
      method: req.method,
      route: route,
      status: res.statusCode.toString(),
    };
    
    httpRequestDuration.observe(labels, duration);
    httpRequestTotal.inc(labels);
    activeConnections.dec();
  });
  
  next();
}

// Setup metrics endpoint
export function setupMetrics(app: Express) {
  // Add metrics middleware
  app.use(metricsMiddleware);
  
  // Metrics endpoint
  app.get('/metrics', (req, res) => {
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
export function trackCacheHit(operation: string, hit: boolean) {
  cacheHitRate.observe({ operation }, hit ? 1 : 0);
}

// Track errors
export function trackError(type: string, code: string, source: string) {
  errorRate.inc({ type, code, source });
}