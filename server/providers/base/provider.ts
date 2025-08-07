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
      name: this.name,
      type: this.type,
      priority: this.priority,
      enabled: true,
      timeout: 30000, // 30 секунд по умолчанию
      retryAttempts: 3,
      cacheTimeout: 3600, // 1 час по умолчанию
      ...config
    };
    
    this.metrics = {
      provider: this.name,
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
    // Проверяем статус провайдера
    if (this.status !== ProviderStatus.ACTIVE) {
      throw new ProviderError(
        this.name,
        'PROVIDER_INACTIVE',
        `Provider ${this.name} is not active`,
        false
      );
    }
    
    const startTime = Date.now();
    this.metrics.requestCount++;
    
    try {
      // Проверяем кеш
      const cacheKey = this.generateCacheKey('search', params);
      const cached = await this.getCached(cacheKey);
      if (cached) {
        console.log(`[${this.name}] Returning cached results`);
        return cached;
      }
      
      // Выполняем поиск
      const results = await this.search(params);
      
      // Сохраняем в кеш
      await this.cacheResult(cacheKey, results);
      
      // Обновляем метрики
      const duration = Date.now() - startTime;
      this.updateMetrics(true, duration);
      
      console.log(`[${this.name}] Search completed in ${duration}ms, found ${results.length} results`);
      
      return results;
    } catch (error) {
      // Обновляем метрики
      const duration = Date.now() - startTime;
      this.updateMetrics(false, duration, error as Error);
      
      // Обрабатываем ошибку
      throw this.handleError(error);
    }
  }
  
  /**
   * Получение текущего статуса провайдера
   */
  getStatus(): ProviderStatus {
    return this.status;
  }
  
  /**
   * Установка статуса провайдера
   */
  setStatus(status: ProviderStatus): void {
    this.status = status;
    console.log(`[${this.name}] Status changed to ${status}`);
  }
  
  /**
   * Получение метрик провайдера
   */
  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }
  
  /**
   * Сброс метрик
   */
  resetMetrics(): void {
    this.metrics = {
      provider: this.name,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageResponseTime: 0,
      availability: 100
    };
  }
  
  /**
   * Проверка здоровья провайдера
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.validateConfig) {
        return await this.validateConfig();
      }
      return this.status === ProviderStatus.ACTIVE;
    } catch (error) {
      console.error(`[${this.name}] Health check failed:`, error);
      return false;
    }
  }
  
  /**
   * Кеширование результата
   */
  protected async cacheResult(key: string, data: any, ttl?: number): Promise<void> {
    const expiresAt = new Date(Date.now() + (ttl || this.config.cacheTimeout || 3600) * 1000);
    this.cache.set(key, { data, expiresAt });
    
    // Очищаем устаревшие записи
    this.cleanupCache();
  }
  
  /**
   * Получение из кеша
   */
  protected async getCached(key: string): Promise<any> {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (cached.expiresAt < new Date()) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }
  
  /**
   * Очистка кеша
   */
  protected cleanupCache(): void {
    const now = new Date();
    for (const [key, value] of this.cache.entries()) {
      if (value.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }
  
  /**
   * Генерация ключа кеша
   */
  protected generateCacheKey(operation: string, params: any): string {
    const sortedParams = JSON.stringify(this.sortObject(params));
    return `${this.name}:${operation}:${this.hash(sortedParams)}`;
  }
  
  /**
   * Сортировка объекта для консистентного хеширования
   */
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
  
  /**
   * Простая хеш-функция для ключей кеша
   */
  private hash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }
  
  /**
   * Обработка ошибок
   */
  protected handleError(error: any): never {
    if (error instanceof ProviderError) {
      throw error;
    }
    
    // Преобразуем общие ошибки в ProviderError
    const message = error.message || 'Unknown error';
    const isRetryable = this.isRetryableError(error);
    
    throw new ProviderError(
      this.name,
      'PROVIDER_ERROR',
      message,
      isRetryable
    );
  }
  
  /**
   * Определение, можно ли повторить запрос при ошибке
   */
  protected isRetryableError(error: any): boolean {
    // Сетевые ошибки обычно можно повторить
    if (error.code === 'ECONNREFUSED' || 
        error.code === 'ETIMEDOUT' ||
        error.code === 'ENOTFOUND') {
      return true;
    }
    
    // HTTP ошибки 5xx обычно временные
    if (error.response && error.response.status >= 500) {
      return true;
    }
    
    // 429 Too Many Requests - можно повторить позже
    if (error.response && error.response.status === 429) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Обновление метрик
   */
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
    
    // Обновляем среднее время ответа
    const totalRequests = this.metrics.successCount + this.metrics.errorCount;
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (totalRequests - 1) + duration) / totalRequests;
    
    // Обновляем доступность
    this.metrics.availability = (this.metrics.successCount / totalRequests) * 100;
  }
  
  /**
   * Форматирование даты для API
   */
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
  
  /**
   * Парсинг даты из строки
   */
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
  
  /**
   * Задержка выполнения (для rate limiting)
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}