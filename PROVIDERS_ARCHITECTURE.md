# Архитектура системы провайдеров

## Обзор

Система провайдеров разработана для унифицированной работы с различными поставщиками туристических услуг. Архитектура позволяет легко добавлять новых провайдеров и типы услуг.

## Базовая структура

```
/server/providers/
├── index.ts              # Главный файл с интерфейсами и агрегацией
├── base/                 # Базовые классы и интерфейсы
│   ├── provider.ts       # Абстрактный базовый класс
│   ├── types.ts          # Общие типы данных
│   └── errors.ts         # Специфичные ошибки провайдеров
├── tours/                # Провайдеры туров
│   ├── leveltravel.ts    # Level.Travel (текущий)
│   ├── sletat.ts         # Слетать.ру (заглушка)
│   └── travelata.ts      # Travelata (заглушка)
├── hotels/               # Провайдеры отелей
│   ├── ostrovok.ts       # Ostrovok.ru
│   ├── yandex.ts         # Яндекс.Путешествия
│   └── sutochno.ts       # Суточно.ру
├── flights/              # Провайдеры авиабилетов
│   ├── aviasales.ts      # Aviasales
│   └── tutu.ts           # Tutu.ru
├── services/             # Дополнительные услуги
│   ├── transfers/        # Трансферы
│   ├── excursions/       # Экскурсии
│   └── rentals/          # Прокат авто
└── utils/                # Вспомогательные функции
    ├── cache.ts          # Кеширование результатов
    ├── rate-limiter.ts   # Ограничение запросов
    └── normalizer.ts     # Нормализация данных
```

## Основные интерфейсы

### Базовый интерфейс провайдера

```typescript
// base/provider.ts
export abstract class BaseProvider<TSearchParams, TResult> {
  abstract readonly name: string;
  abstract readonly type: ProviderType;
  abstract readonly priority: number; // Для сортировки результатов
  
  // Основные методы
  abstract search(params: TSearchParams): Promise<TResult[]>;
  abstract getDetails(id: string): Promise<TResult>;
  
  // Опциональные методы
  async checkAvailability?(id: string): Promise<boolean>;
  async book?(id: string, params: BookingParams): Promise<BookingResult>;
  async cancel?(bookingId: string): Promise<CancelResult>;
  
  // Служебные методы
  protected async cacheResult(key: string, data: any): Promise<void>;
  protected async getCached(key: string): Promise<any>;
  protected handleError(error: any): never;
}
```

### Типы провайдеров

```typescript
export enum ProviderType {
  TOURS = 'tours',
  HOTELS = 'hotels',
  FLIGHTS = 'flights',
  TRANSFERS = 'transfers',
  EXCURSIONS = 'excursions',
  RENTALS = 'rentals',
  INSURANCE = 'insurance',
  AUTHOR_TOURS = 'author_tours'
}
```

### Унифицированные параметры поиска

```typescript
// base/types.ts
export interface BaseSearchParams {
  // Основные параметры
  destination?: string;      // Направление
  startDate?: Date;         // Дата начала
  endDate?: Date;           // Дата окончания
  adults?: number;          // Взрослые
  children?: number;        // Дети
  childrenAges?: number[];  // Возраст детей
  
  // Бюджет
  budget?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  
  // Фильтры
  filters?: Record<string, any>;
  
  // Пагинация
  page?: number;
  limit?: number;
  
  // Сортировка
  sortBy?: SortOption;
  sortOrder?: 'asc' | 'desc';
}

export interface TourSearchParams extends BaseSearchParams {
  hotelStars?: number[];
  mealTypes?: string[];
  beachLine?: number;
  tripDuration?: number;
}

export interface HotelSearchParams extends BaseSearchParams {
  stars?: number[];
  amenities?: string[];
  propertyTypes?: string[];
  distanceFromCenter?: number;
}
```

### Унифицированный результат

```typescript
export interface BaseResult {
  // Идентификация
  id: string;               // Внутренний ID
  providerId: string;       // ID у провайдера
  provider: string;         // Название провайдера
  
  // Основная информация
  title: string;
  description?: string;
  
  // Цены
  price: {
    amount: number;
    currency: string;
    oldAmount?: number;     // Цена до скидки
  };
  
  // Медиа
  images: string[];
  mainImage?: string;
  
  // Метаданные
  rating?: number;
  reviews?: number;
  
  // Ссылки
  bookingUrl: string;       // Ссылка на бронирование
  detailsUrl?: string;      // Ссылка на детали
  
  // Служебные данные
  metadata?: any;           // Дополнительные данные провайдера
  score?: number;           // Релевантность результата
}
```

## Система агрегации

### Менеджер провайдеров

```typescript
// providers/manager.ts
export class ProvidersManager {
  private providers: Map<string, BaseProvider<any, any>> = new Map();
  
  // Регистрация провайдера
  register(provider: BaseProvider<any, any>): void {
    this.providers.set(provider.name, provider);
  }
  
  // Поиск по всем провайдерам типа
  async searchByType(
    type: ProviderType, 
    params: BaseSearchParams
  ): Promise<AggregatedResults> {
    const providers = this.getProvidersByType(type);
    const results = await this.parallelSearch(providers, params);
    return this.aggregateResults(results);
  }
  
  // Агрегация результатов
  private aggregateResults(results: ProviderResults[]): AggregatedResults {
    return {
      items: this.deduplicateAndRank(results),
      providers: results.map(r => r.provider),
      totalCount: results.reduce((sum, r) => sum + r.count, 0),
      searchId: generateSearchId()
    };
  }
}
```

### Дедупликация и ранжирование

```typescript
// providers/utils/deduplicator.ts
export class ResultDeduplicator {
  // Определение дубликатов по различным критериям
  findDuplicates(results: BaseResult[]): DuplicateGroups {
    const groups = new Map<string, BaseResult[]>();
    
    for (const result of results) {
      const key = this.generateKey(result);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(result);
    }
    
    return groups;
  }
  
  // Генерация ключа для сравнения
  private generateKey(result: BaseResult): string {
    // Для отелей - название + город
    // Для туров - отель + даты + оператор
    // И т.д. в зависимости от типа
  }
  
  // Выбор лучшего предложения из дубликатов
  selectBest(duplicates: BaseResult[]): BaseResult {
    return duplicates.sort((a, b) => {
      // Приоритет: цена -> рейтинг провайдера -> актуальность
    })[0];
  }
}
```

## Кеширование

### Стратегия кеширования

```typescript
// providers/utils/cache.ts
export class ProviderCache {
  private redis: Redis;
  
  // Кеширование результатов поиска
  async cacheSearchResults(
    provider: string,
    params: BaseSearchParams,
    results: any[],
    ttl: number = 3600 // 1 час по умолчанию
  ): Promise<void> {
    const key = this.generateCacheKey(provider, params);
    await this.redis.setex(key, ttl, JSON.stringify(results));
  }
  
  // Инвалидация кеша
  async invalidate(pattern: string): Promise<void> {
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
```

## Обработка ошибок

### Специфичные ошибки провайдеров

```typescript
// base/errors.ts
export class ProviderError extends Error {
  constructor(
    public provider: string,
    public code: string,
    message: string,
    public isRetryable: boolean = false
  ) {
    super(message);
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(provider: string) {
    super(provider, 'AUTH_ERROR', 'Authentication failed', false);
  }
}

export class ProviderRateLimitError extends ProviderError {
  constructor(provider: string, public retryAfter?: number) {
    super(provider, 'RATE_LIMIT', 'Rate limit exceeded', true);
  }
}

export class ProviderTimeoutError extends ProviderError {
  constructor(provider: string) {
    super(provider, 'TIMEOUT', 'Request timeout', true);
  }
}
```

### Обработчик ошибок с retry

```typescript
// providers/utils/error-handler.ts
export class ProviderErrorHandler {
  async handleWithRetry<T>(
    operation: () => Promise<T>,
    provider: string,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (error instanceof ProviderError && !error.isRetryable) {
          throw error;
        }
        
        if (error instanceof ProviderRateLimitError && error.retryAfter) {
          await this.delay(error.retryAfter * 1000);
        } else {
          await this.delay(Math.pow(2, i) * 1000); // Exponential backoff
        }
      }
    }
    
    throw lastError!;
  }
}
```

## Мониторинг и метрики

### Сбор метрик провайдеров

```typescript
// providers/monitoring/metrics.ts
export class ProviderMetrics {
  // Метрики производительности
  async recordSearchDuration(provider: string, duration: number): Promise<void>;
  async recordSearchResults(provider: string, count: number): Promise<void>;
  async recordError(provider: string, error: Error): Promise<void>;
  
  // Метрики доступности
  async recordAvailability(provider: string, available: boolean): Promise<void>;
  async recordResponseTime(provider: string, time: number): Promise<void>;
  
  // Бизнес-метрики
  async recordConversion(provider: string, searchId: string): Promise<void>;
  async recordBooking(provider: string, amount: number): Promise<void>;
}
```

## Примеры реализации провайдеров

### Провайдер отелей (Ostrovok)

```typescript
// providers/hotels/ostrovok.ts
export class OstrovokProvider extends BaseProvider<HotelSearchParams, HotelResult> {
  readonly name = 'ostrovok';
  readonly type = ProviderType.HOTELS;
  readonly priority = 10;
  
  async search(params: HotelSearchParams): Promise<HotelResult[]> {
    // Преобразование параметров в формат API Ostrovok
    const apiParams = this.transformParams(params);
    
    // Запрос к API с обработкой ошибок
    const response = await this.apiClient.searchHotels(apiParams);
    
    // Нормализация результатов
    return response.data.hotels.map(hotel => this.normalizeHotel(hotel));
  }
  
  private normalizeHotel(hotel: OstrovokHotel): HotelResult {
    return {
      id: `ostrovok-${hotel.id}`,
      providerId: hotel.id.toString(),
      provider: this.name,
      title: hotel.name,
      description: hotel.description,
      price: {
        amount: hotel.price_from,
        currency: hotel.currency
      },
      images: hotel.images.map(img => img.url),
      mainImage: hotel.main_image?.url,
      rating: hotel.rating,
      reviews: hotel.reviews_count,
      bookingUrl: this.generateBookingUrl(hotel.id),
      metadata: {
        stars: hotel.stars,
        amenities: hotel.amenities,
        location: hotel.location
      }
    };
  }
}
```

## Roadmap развития

1. **Фаза 1: Базовая инфраструктура**
   - [x] Интерфейсы и базовые классы
   - [x] Level.Travel для туров
   - [ ] Система кеширования
   - [ ] Обработка ошибок с retry

2. **Фаза 2: Расширение провайдеров**
   - [ ] Ostrovok для отелей
   - [ ] Aviasales для перелетов
   - [ ] Яндекс.Путешествия
   - [ ] Sutochno.ru

3. **Фаза 3: Оптимизация**
   - [ ] Умная дедупликация
   - [ ] ML-ранжирование результатов
   - [ ] Предиктивное кеширование
   - [ ] A/B тестирование провайдеров

4. **Фаза 4: Расширенные функции**
   - [ ] Динамическое пакетирование
   - [ ] Кросс-продажи между сервисами
   - [ ] Персонализация под пользователя
   - [ ] Автоматическое переключение провайдеров