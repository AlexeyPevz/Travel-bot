# Error Handling & Retry Logic Guide

## Обзор

Проект использует комплексную систему обработки ошибок с автоматическими повторными попытками для повышения надежности.

## Архитектура

### 1. Классификация ошибок

```typescript
// Базовый класс для всех ошибок приложения
class AppError extends Error {
  statusCode: number;
  isOperational: boolean; // true = ожидаемая ошибка, false = баг
  code?: string;
  details?: any;
}
```

### 2. Типы ошибок

- **ValidationError** (400) - ошибки валидации данных
- **AuthenticationError** (401) - требуется аутентификация
- **AuthorizationError** (403) - недостаточно прав
- **NotFoundError** (404) - ресурс не найден
- **ConflictError** (409) - конфликт данных
- **RateLimitError** (429) - превышен лимит запросов
- **ExternalServiceError** (503) - ошибка внешнего сервиса
- **DatabaseError** (500) - ошибка базы данных

## Использование

### 1. В контроллерах

```typescript
import { asyncHandler, NotFoundError, ValidationError } from '../utils/errors';

// Автоматическая обработка async ошибок
app.get('/api/profile/:id', asyncHandler(async (req, res) => {
  const profile = await db.profiles.findOne({ id: req.params.id });
  
  if (!profile) {
    throw new NotFoundError('Profile', req.params.id);
  }
  
  res.json(profile);
}));

// Валидация данных
app.post('/api/profile', asyncHandler(async (req, res) => {
  const { error } = profileSchema.validate(req.body);
  
  if (error) {
    throw new ValidationError('Invalid profile data', error.details);
  }
  
  // ...
}));
```

### 2. В сервисах

```typescript
import { ExternalServiceError, DatabaseError } from '../utils/errors';

async function fetchFromAPI() {
  try {
    const response = await axios.get('https://api.example.com/data');
    return response.data;
  } catch (error) {
    throw new ExternalServiceError('Example API', error);
  }
}

async function saveToDatabase(data) {
  try {
    return await db.insert(data);
  } catch (error) {
    throw new DatabaseError('Failed to save data', error);
  }
}
```

## Retry Logic

### 1. Базовое использование

```typescript
import { retry, RetryStrategies } from '../utils/retry';

// С дефолтными настройками
const result = await retry(() => fetchData());

// С кастомными настройками
const result = await retry(() => fetchData(), {
  maxAttempts: 5,
  initialDelay: 1000,
  backoffMultiplier: 2,
  maxDelay: 30000,
});

// С предустановленной стратегией
const result = await retry(
  () => apiClient.get('/data'),
  RetryStrategies.api
);
```

### 2. Стратегии retry

```typescript
// Для API вызовов
RetryStrategies.api = {
  maxAttempts: 5,
  initialDelay: 1000,
  maxDelay: 60000,
  backoffMultiplier: 2,
  jitter: true,
};

// Для базы данных
RetryStrategies.database = {
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 5000,
  backoffMultiplier: 2,
};

// Для внешних сервисов
RetryStrategies.external = {
  maxAttempts: 4,
  initialDelay: 2000,
  maxDelay: 30000,
  backoffMultiplier: 3,
};
```

### 3. Функции с встроенным retry

```typescript
import { withRetry } from '../utils/retry';

// Создаем функцию с retry
const fetchWithRetry = withRetry(
  async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  },
  RetryStrategies.api
);

// Используем
const data = await fetchWithRetry('https://api.example.com/data');
```

### 4. Декоратор для классов

```typescript
import { Retryable } from '../utils/retry';

class APIService {
  @Retryable({ maxAttempts: 3 })
  async fetchData() {
    // Этот метод автоматически повторится при ошибке
    const response = await axios.get('/api/data');
    return response.data;
  }
}
```

## Circuit Breaker

Защита от каскадных сбоев:

```typescript
import { CircuitBreaker } from '../utils/retry';

const breaker = new CircuitBreaker(
  5,     // threshold - количество ошибок для открытия
  60000, // timeout - время в открытом состоянии (мс)
  30000  // resetTimeout - время для сброса счетчика
);

// Использование
try {
  const result = await breaker.execute(() => 
    externalAPI.call()
  );
} catch (error) {
  if (error.message === 'Circuit breaker is OPEN') {
    // Сервис временно недоступен
    return cachedData;
  }
  throw error;
}

// Проверка состояния
const state = breaker.getState();
console.log(state); // { state: 'open', failures: 5, lastFailureTime: ... }
```

## Обработка в Express

### Глобальный error handler

```typescript
// В server/index.ts
import { errorHandler } from './middleware/errorHandler';

// ... все маршруты ...

// Error handler должен быть последним middleware
app.use(errorHandler);
```

### Формат ответов об ошибках

```json
{
  "error": {
    "message": "Profile with id 123 not found",
    "code": "NOT_FOUND",
    "details": null
  }
}
```

В development mode добавляется stack trace:

```json
{
  "error": {
    "message": "Internal server error",
    "code": "INTERNAL_ERROR",
    "stack": "Error: ...\n  at ..."
  }
}
```

## Best Practices

### 1. Всегда используйте типизированные ошибки

```typescript
// ❌ Плохо
throw new Error('User not found');

// ✅ Хорошо
throw new NotFoundError('User', userId);
```

### 2. Добавляйте контекст к ошибкам

```typescript
// ❌ Плохо
throw new ValidationError('Invalid data');

// ✅ Хорошо
throw new ValidationError('Invalid user data', {
  fields: ['email', 'password'],
  values: { email: req.body.email }
});
```

### 3. Используйте asyncHandler для async маршрутов

```typescript
// ❌ Плохо - ошибки не будут перехвачены
app.get('/api/data', async (req, res) => {
  const data = await fetchData(); // Может выбросить ошибку
  res.json(data);
});

// ✅ Хорошо
app.get('/api/data', asyncHandler(async (req, res) => {
  const data = await fetchData();
  res.json(data);
}));
```

### 4. Настраивайте retry стратегию под задачу

```typescript
// Для критичных операций - больше попыток
const criticalRetry = {
  maxAttempts: 10,
  maxDelay: 120000, // 2 минуты
  shouldRetry: (error) => error.status !== 404 // 404 не повторяем
};

// Для быстрых операций - меньше задержка
const fastRetry = {
  maxAttempts: 3,
  initialDelay: 100,
  maxDelay: 1000,
};
```

### 5. Логируйте ошибки правильно

```typescript
// В error handler автоматически логируются:
// - Operational errors как warnings
// - Unexpected errors как errors
// - С контекстом: URL, метод, user ID, correlation ID
```

## Мониторинг ошибок

### Метрики Prometheus

```typescript
// Автоматически собираются метрики:
http_request_errors_total{method="GET", route="/api/profile/:id", status="404"}
http_request_retries_total{service="leveltravel", status="success"}
circuit_breaker_state{service="openrouter", state="open"}
```

### Алерты

```yaml
# prometheus/alerts.yml
- alert: HighErrorRate
  expr: rate(http_request_errors_total[5m]) > 0.1
  annotations:
    summary: "High error rate detected"
    
- alert: CircuitBreakerOpen
  expr: circuit_breaker_state == 1
  for: 5m
  annotations:
    summary: "Circuit breaker is open for {{ $labels.service }}"
```

## Тестирование

### Unit тесты для ошибок

```typescript
describe('Error Handling', () => {
  it('should retry on 5xx errors', async () => {
    const mock = jest.fn()
      .mockRejectedValueOnce({ status: 500 })
      .mockRejectedValueOnce({ status: 503 })
      .mockResolvedValue({ data: 'success' });
    
    const result = await retry(mock, { maxAttempts: 3 });
    
    expect(mock).toHaveBeenCalledTimes(3);
    expect(result.data).toBe('success');
  });
  
  it('should not retry on 4xx errors', async () => {
    const mock = jest.fn()
      .mockRejectedValue({ status: 404 });
    
    await expect(retry(mock)).rejects.toThrow();
    expect(mock).toHaveBeenCalledTimes(1);
  });
});
```

### Integration тесты

```typescript
describe('API Error Handling', () => {
  it('should return proper error format', async () => {
    const response = await request(app)
      .get('/api/profile/invalid-id')
      .expect(404);
    
    expect(response.body).toEqual({
      error: {
        message: 'Profile with id invalid-id not found',
        code: 'NOT_FOUND',
        details: null
      }
    });
  });
});
```