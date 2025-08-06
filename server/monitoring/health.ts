import { db } from '../../db';
import redis from '../services/cache';
import logger from '../utils/logger';
import os from 'os';

export interface HealthCheck {
  service: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  latency?: number;
  error?: string;
  details?: any;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  uptime: number;
  checks: HealthCheck[];
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      load: number[];
      cores: number;
    };
  };
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Simple query to check database connectivity
    const result = await db.execute('SELECT 1 as health');
    const latency = Date.now() - start;
    
    return {
      service: 'postgresql',
      status: 'healthy',
      latency,
      details: { connected: true },
    };
  } catch (error) {
    logger.error('Database health check failed:', error);
    return {
      service: 'postgresql',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    await redis.ping();
    const latency = Date.now() - start;
    
    return {
      service: 'redis',
      status: 'healthy',
      latency,
      details: { connected: true },
    };
  } catch (error) {
    logger.error('Redis health check failed:', error);
    return {
      service: 'redis',
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkExternalAPIs(): Promise<HealthCheck[]> {
  const checks: HealthCheck[] = [];
  
  // Check LevelTravel API
  try {
    const start = Date.now();
    const response = await fetch('https://api.level.travel/v1/references/cities', {
      method: 'HEAD',
      timeout: 5000,
    } as any);
    
    checks.push({
      service: 'leveltravel-api',
      status: response.ok ? 'healthy' : 'degraded',
      latency: Date.now() - start,
      details: { statusCode: response.status },
    });
  } catch (error) {
    checks.push({
      service: 'leveltravel-api',
      status: 'degraded',
      error: 'Failed to reach API',
    });
  }
  
  // Check OpenRouter API if configured
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const start = Date.now();
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        },
        timeout: 5000,
      } as any);
      
      checks.push({
        service: 'openrouter-api',
        status: response.ok ? 'healthy' : 'degraded',
        latency: Date.now() - start,
        details: { statusCode: response.status },
      });
    } catch (error) {
      checks.push({
        service: 'openrouter-api',
        status: 'degraded',
        error: 'Failed to reach API',
      });
    }
  }
  
  return checks;
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const checks: HealthCheck[] = [];
  
  // Run all health checks in parallel
  const [dbCheck, redisCheck, apiChecks] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkExternalAPIs(),
  ]);
  
  checks.push(dbCheck, redisCheck, ...apiChecks);
  
  // Determine overall status
  const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
  const hasDegraded = checks.some(c => c.status === 'degraded');
  
  let status: 'healthy' | 'unhealthy' | 'degraded';
  if (hasUnhealthy) {
    status = 'unhealthy';
  } else if (hasDegraded) {
    status = 'degraded';
  } else {
    status = 'healthy';
  }
  
  // Get system metrics
  const memUsage = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  return {
    status,
    timestamp: new Date(),
    uptime: process.uptime(),
    checks,
    system: {
      memory: {
        used: usedMem,
        total: totalMem,
        percentage: (usedMem / totalMem) * 100,
      },
      cpu: {
        load: os.loadavg(),
        cores: os.cpus().length,
      },
    },
  };
}

// Readiness check - are we ready to accept traffic?
export async function getReadinessStatus(): Promise<{ ready: boolean; checks: HealthCheck[] }> {
  const [dbCheck, redisCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
  ]);
  
  const checks = [dbCheck, redisCheck];
  const ready = checks.every(c => c.status === 'healthy');
  
  return { ready, checks };
}

// Liveness check - is the process alive?
export function getLivenessStatus(): { alive: boolean; uptime: number } {
  return {
    alive: true,
    uptime: process.uptime(),
  };
}