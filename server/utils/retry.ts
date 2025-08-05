import logger from './logger';

export interface RetryOptions {
  /**
   * Максимальное количество попыток (включая первую)
   */
  maxAttempts?: number;
  
  /**
   * Начальная задержка в миллисекундах
   */
  initialDelay?: number;
  
  /**
   * Максимальная задержка в миллисекундах
   */
  maxDelay?: number;
  
  /**
   * Множитель для exponential backoff
   */
  backoffMultiplier?: number;
  
  /**
   * Добавлять ли случайную задержку (jitter) для предотвращения thundering herd
   */
  jitter?: boolean;
  
  /**
   * Функция для определения, нужно ли повторять попытку
   */
  shouldRetry?: (error: any, attempt: number) => boolean;
  
  /**
   * Callback при каждой неудачной попытке
   */
  onRetry?: (error: any, attempt: number, delay: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  shouldRetry: (error) => {
    // Повторяем при сетевых ошибках и 5xx статусах
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return true;
    }
    
    // Для HTTP ошибок проверяем статус
    if (error.status) {
      // Повторяем при 5xx (серверные ошибки) и некоторых 4xx
      return error.status >= 500 || error.status === 429 || error.status === 408;
    }
    
    // По умолчанию повторяем
    return true;
  },
  onRetry: (error, attempt, delay) => {
    logger.warn(`Retry attempt ${attempt} after ${delay}ms`, {
      error: error.message,
      code: error.code,
      status: error.status,
    });
  },
};

/**
 * Выполняет функцию с автоматическими повторными попытками
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  let lastError: any;
  
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Проверяем, нужно ли повторять
      if (attempt === opts.maxAttempts || !opts.shouldRetry(error, attempt)) {
        throw error;
      }
      
      // Вычисляем задержку с exponential backoff
      let delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelay
      );
      
      // Добавляем jitter если включен
      if (opts.jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }
      
      // Вызываем callback
      opts.onRetry(error, attempt, Math.round(delay));
      
      // Ждем перед следующей попыткой
      await sleep(delay);
    }
  }
  
  throw lastError;
}

/**
 * Создает функцию с встроенной retry логикой
 */
export function withRetry<TArgs extends any[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs) => {
    return retry(() => fn(...args), options);
  };
}

/**
 * Декоратор для методов класса с retry логикой
 */
export function Retryable(options: RetryOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      return retry(() => originalMethod.apply(this, args), options);
    };
    
    return descriptor;
  };
}

/**
 * Circuit breaker для предотвращения каскадных сбоев
 */
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  
  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 минута
    private readonly resetTimeout: number = 30000 // 30 секунд
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const now = Date.now();
      if (now - this.lastFailureTime > this.timeout) {
        this.state = 'half-open';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failures = 0;
      }
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();
      
      if (this.failures >= this.threshold) {
        this.state = 'open';
        logger.error('Circuit breaker opened', {
          failures: this.failures,
          threshold: this.threshold,
        });
      }
      
      throw error;
    }
  }
  
  reset() {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
  }
  
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Вспомогательная функция для задержки
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Специализированные retry стратегии
 */
export const RetryStrategies = {
  /**
   * Для API вызовов с rate limiting
   */
  api: {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    jitter: true,
    shouldRetry: (error: any) => {
      // Особая обработка для rate limiting
      if (error.status === 429) {
        // Проверяем заголовок Retry-After
        const retryAfter = error.headers?.['retry-after'];
        if (retryAfter) {
          const delay = parseInt(retryAfter, 10) * 1000;
          return delay < 60000; // Не ждем больше минуты
        }
      }
      return DEFAULT_OPTIONS.shouldRetry(error, 1);
    },
  },
  
  /**
   * Для работы с базой данных
   */
  database: {
    maxAttempts: 3,
    initialDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 2,
    jitter: true,
    shouldRetry: (error: any) => {
      // Повторяем при deadlock и connection errors
      const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'];
      return retryableCodes.includes(error.code) || 
             error.message?.includes('deadlock') ||
             error.message?.includes('connection');
    },
  },
  
  /**
   * Для внешних сервисов (OpenRouter, Level.Travel)
   */
  external: {
    maxAttempts: 4,
    initialDelay: 2000,
    maxDelay: 30000,
    backoffMultiplier: 3,
    jitter: true,
    shouldRetry: (error: any, attempt: number) => {
      // Не повторяем при ошибках аутентификации
      if (error.status === 401 || error.status === 403) {
        return false;
      }
      // Ограничиваем повторы для client errors
      if (error.status >= 400 && error.status < 500) {
        return attempt <= 2;
      }
      return DEFAULT_OPTIONS.shouldRetry(error, attempt);
    },
  },
};