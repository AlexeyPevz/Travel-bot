/**
 * Абстрактный базовый класс для всех провайдеров туристических услуг
 */

import { 
  BaseSearchParams, 
  BaseResult, 
  BookingParams, 
  BookingResult, 
  CancelResult,
  ProviderType,
  ProviderStatus,
  ProviderConfig,
  ProviderMetrics
} from './types';
import { ProviderError } from './errors';

export abstract class BaseProvider<TSearchParams extends BaseSearchParams, TResult extends BaseResult> {
  // Обязательные свойства для реализации
  abstract readonly name: string;
  abstract readonly type: ProviderType;
  abstract readonly priority: number; // Приоритет при сортировке результатов (1-100)
  
  // Конфигурация провайдера
  protected config: ProviderConfig;
  protected status: ProviderStatus = ProviderStatus.ACTIVE;
  protected metrics: ProviderMetrics;
  
  // Кеш для результатов (в продакшене использовать Redis)
  private cache: Map<string, { data: any; expiresAt: Date }> = new Map();
  
  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = {
      name: config.name ?? (this as any).name,
      type: config.type ?? (this as any).type,
      priority: config.priority ?? (this as any).priority,
      enabled: config.enabled ?? true,
      timeout: config.timeout ?? 30000,
      retryAttempts: config.retryAttempts ?? 3,
      cacheTimeout: config.cacheTimeout ?? 3600,
      rateLimit: config.rateLimit,
    } as ProviderConfig;
    
    this.metrics = {
      provider: this.config.name,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      availability: 100
    };
  }
  
  /**
   * Основной метод поиска - должен быть реализован в наследниках
   */
  abstract search(params: TSearchParams): Promise<TResult[]>;
  
  /**
   * Получение детальной информации - должен быть реализован в наследниках
   */
  abstract getDetails(id: string): Promise<TResult>;
  
  /**
   * Проверка доступности предложения (опционально)
   */
  async checkAvailability?(id: string): Promise<boolean>;
  
  /**
   * Бронирование (опционально)
   */
  async book?(id: string, params: BookingParams): Promise<BookingResult>;
  
  /**
   * Отмена бронирования (опционально)
   */
  async cancel?(bookingId: string): Promise<CancelResult>;
  
  /**
   * Валидация конфигурации провайдера (опционально)
   */
  async validateConfig?(): Promise<boolean>;
  
  /**
   * Обертка для поиска с метриками и обработкой ошибок
   */
  async performSearch(params: TSearchParams): Promise<TResult[]> {
    if (this.status !== ProviderStatus.ACTIVE) {
      throw new ProviderError(
        this.config.name,
        'PROVIDER_INACTIVE',
        `Provider ${this.config.name} is not active`,
        false
      );
    }
    
    const startTime = Date.now();
    this.metrics.requestCount++;
    
    try {
      const cacheKey = this.generateCacheKey('search', params);
      const cached = await this.getCached(cacheKey);
      if (cached) {
        return cached;
      }
      
      const results = await this.search(params);
      await this.cacheResult(cacheKey, results);
      
      const duration = Date.now() - startTime;
      this.updateMetrics(true, duration);
      
      return results;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.updateMetrics(false, duration, error as Error);
      throw this.handleError(error);
    }
  }
  
  getStatus(): ProviderStatus {
    return this.status;
  }
  
  setStatus(status: ProviderStatus): void {
    this.status = status;
  }
  
  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }
  
  resetMetrics(): void {
    this.metrics = {
      provider: this.config.name,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      availability: 100
    };
  }
  
  async healthCheck(): Promise<boolean> {
    try {
      if (this.validateConfig) {
        return await this.validateConfig();
      }
      return this.status === ProviderStatus.ACTIVE;
    } catch (error) {
      return false;
    }
  }
  
  protected async cacheResult(key: string, data: any, ttl?: number): Promise<void> {
    const expiresAt = new Date(Date.now() + (ttl || this.config.cacheTimeout || 3600) * 1000);
    this.cache.set(key, { data, expiresAt });
    this.cleanupCache();
  }
  
  protected async getCached(key: string): Promise<any> {
    const cached = this.cache.get(key);
    if (!cached) return null;
    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }
    return cached.data;
  }
  
  protected cleanupCache(): void {
    const now = new Date();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt < now) this.cache.delete(key);
    }
  }
  
  protected generateCacheKey(operation: string, params: any): string {
    const sortedParams = JSON.stringify(this.sortObject(params));
    return `${this.config.name}:${operation}:${this.hash(sortedParams)}`;
  }
  
  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortObject(item));
    return Object.keys(obj)
      .sort()
      .reduce((sorted: any, key) => {
        sorted[key] = this.sortObject(obj[key]);
        return sorted;
      }, {});
  }
  
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  protected handleError(error: any): never {
    if (error instanceof ProviderError) {
      throw error;
    }
    const message = error.message || 'Unknown error';
    const isRetryable = this.isRetryableError(error);
    throw new ProviderError(
      this.config.name,
      'PROVIDER_ERROR',
      message,
      isRetryable
    );
  }
  
  protected isRetryableError(error: any): boolean {
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }
    if (error.response && error.response.status >= 500) return true;
    if (error.response && error.response.status === 429) return true;
    return false;
  }
  
  private updateMetrics(success: boolean, duration: number, error?: Error): void {
    if (success) {
      this.metrics.successCount++;
    } else {
      this.metrics.errorCount++;
      if (error) {
        this.metrics.lastError = {
          message: error.message,
          timestamp: new Date()
        };
      }
    }
    const totalRequests = this.metrics.successCount + this.metrics.errorCount;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + duration) / totalRequests;
    this.metrics.availability = (this.metrics.successCount / totalRequests) * 100;
  }
  
  protected formatDate(date: Date, format: string = 'YYYY-MM-DD'): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    switch (format) {
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD.MM.YYYY':
        return `${day}.${month}.${year}`;
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }
  
  protected parseDate(dateString: string, format: string = 'YYYY-MM-DD'): Date {
    const parts = dateString.split(/[-.\/ ]/);
    switch (format) {
      case 'YYYY-MM-DD':
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      case 'DD.MM.YYYY':
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      case 'MM/DD/YYYY':
        return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      default:
        return new Date(dateString);
    }
  }
  
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}