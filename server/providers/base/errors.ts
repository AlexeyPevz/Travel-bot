/**
 * Специфичные ошибки для системы провайдеров
 */

/**
 * Базовый класс ошибки провайдера
 */
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public code: string,
    message: string,
    public isRetryable: boolean = false,
    public details?: any
  ) {
    super(message);
    this.name = 'ProviderError';
  }
  
  toJSON() {
    return {
      name: this.name,
      provider: this.provider,
      code: this.code,
      message: this.message,
      isRetryable: this.isRetryable,
      details: this.details
    };
  }
}

/**
 * Ошибка аутентификации
 */
export class ProviderAuthError extends ProviderError {
  constructor(provider: string, message: string = 'Authentication failed') {
    super(provider, 'AUTH_ERROR', message, false);
    this.name = 'ProviderAuthError';
  }
}

/**
 * Ошибка превышения лимита запросов
 */
export class ProviderRateLimitError extends ProviderError {
  constructor(
    provider: string, 
    public retryAfter?: number,
    message: string = 'Rate limit exceeded'
  ) {
    super(provider, 'RATE_LIMIT', message, true, { retryAfter });
    this.name = 'ProviderRateLimitError';
  }
}

/**
 * Ошибка таймаута запроса
 */
export class ProviderTimeoutError extends ProviderError {
  constructor(
    provider: string,
    public timeout: number,
    message: string = 'Request timeout'
  ) {
    super(provider, 'TIMEOUT', message, true, { timeout });
    this.name = 'ProviderTimeoutError';
  }
}

/**
 * Ошибка валидации данных
 */
export class ProviderValidationError extends ProviderError {
  constructor(
    provider: string,
    public field: string,
    message: string
  ) {
    super(provider, 'VALIDATION_ERROR', message, false, { field });
    this.name = 'ProviderValidationError';
  }
}

/**
 * Ошибка недоступности сервиса
 */
export class ProviderUnavailableError extends ProviderError {
  constructor(
    provider: string,
    message: string = 'Service temporarily unavailable'
  ) {
    super(provider, 'SERVICE_UNAVAILABLE', message, true);
    this.name = 'ProviderUnavailableError';
  }
}

/**
 * Ошибка неверного формата ответа
 */
export class ProviderResponseError extends ProviderError {
  constructor(
    provider: string,
    message: string = 'Invalid response format',
    public response?: any
  ) {
    super(provider, 'INVALID_RESPONSE', message, false, { response });
    this.name = 'ProviderResponseError';
  }
}

/**
 * Ошибка не найденного ресурса
 */
export class ProviderNotFoundError extends ProviderError {
  constructor(
    provider: string,
    resource: string,
    id: string
  ) {
    super(
      provider, 
      'NOT_FOUND', 
      `${resource} with id ${id} not found`,
      false,
      { resource, id }
    );
    this.name = 'ProviderNotFoundError';
  }
}

/**
 * Ошибка конфигурации провайдера
 */
export class ProviderConfigError extends ProviderError {
  constructor(
    provider: string,
    message: string
  ) {
    super(provider, 'CONFIG_ERROR', message, false);
    this.name = 'ProviderConfigError';
  }
}

/**
 * Ошибка квоты или лимитов провайдера
 */
export class ProviderQuotaError extends ProviderError {
  constructor(
    provider: string,
    quotaType: string,
    message: string
  ) {
    super(provider, 'QUOTA_EXCEEDED', message, false, { quotaType });
    this.name = 'ProviderQuotaError';
  }
}

/**
 * Ошибка бизнес-логики провайдера
 */
export class ProviderBusinessError extends ProviderError {
  constructor(
    provider: string,
    businessCode: string,
    message: string,
    details?: any
  ) {
    super(provider, `BUSINESS_${businessCode}`, message, false, details);
    this.name = 'ProviderBusinessError';
  }
}

/**
 * Обработчик ошибок с повторными попытками
 */
export class ErrorHandler {
  static async withRetry<T>(
    operation: () => Promise<T>,
    provider: string,
    maxRetries: number = 3,
    backoffMultiplier: number = 2
  ): Promise<T> {
    let lastError: Error | null = null;
    let delay = 1000; // Начальная задержка 1 секунда
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Проверяем, можно ли повторить
        if (error instanceof ProviderError && !error.isRetryable) {
          throw error;
        }
        
        // Если это последняя попытка, выбрасываем ошибку
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Специальная обработка для rate limit
        if (error instanceof ProviderRateLimitError && error.retryAfter) {
          delay = error.retryAfter * 1000;
        }
        
        console.log(`[${provider}] Attempt ${attempt} failed, retrying in ${delay}ms...`);
        
        // Ждем перед следующей попыткой
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Увеличиваем задержку для следующей попытки
        delay *= backoffMultiplier;
      }
    }
    
    // Этот код не должен выполниться, но для TypeScript
    throw lastError || new Error('Unknown error in retry handler');
  }
  
  /**
   * Преобразование общих ошибок в ProviderError
   */
  static wrapError(error: any, provider: string): ProviderError {
    // Если уже ProviderError, возвращаем как есть
    if (error instanceof ProviderError) {
      return error;
    }
    
    // Axios ошибки
    if (error.isAxiosError) {
      const status = error.response?.status;
      const data = error.response?.data;
      
      switch (status) {
        case 401:
        case 403:
          return new ProviderAuthError(provider, data?.message || error.message);
        
        case 429:
          const retryAfter = error.response?.headers?.['retry-after'];
          return new ProviderRateLimitError(
            provider, 
            retryAfter ? parseInt(retryAfter) : undefined,
            data?.message || error.message
          );
        
        case 404:
          return new ProviderNotFoundError(
            provider,
            'Resource',
            error.config?.url || 'unknown'
          );
        
        case 500:
        case 502:
        case 503:
        case 504:
          return new ProviderUnavailableError(provider, data?.message || error.message);
        
        case 408:
          return new ProviderTimeoutError(
            provider,
            error.config?.timeout || 30000,
            data?.message || error.message
          );
        
        default:
          if (status && status >= 400 && status < 500) {
            return new ProviderValidationError(
              provider,
              'request',
              data?.message || error.message
            );
          }
      }
      
      // Сетевые ошибки
      if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
        return new ProviderTimeoutError(
          provider,
          error.config?.timeout || 30000,
          error.message
        );
      }
      
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return new ProviderUnavailableError(provider, error.message);
      }
    }
    
    // Общая ошибка
    return new ProviderError(
      provider,
      'UNKNOWN_ERROR',
      error.message || 'Unknown error occurred',
      false,
      { originalError: error }
    );
  }
}