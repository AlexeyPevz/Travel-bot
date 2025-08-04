# Rate Limiting Guide

## Обзор

Rate limiting защищает API от злоупотреблений, DDoS-атак и обеспечивает справедливое использование ресурсов всеми пользователями.

## Архитектура

### Хранилище

Используется Redis для хранения счетчиков запросов:
- Быстрый доступ к данным
- Автоматическое истечение ключей (TTL)
- Масштабируемость для распределенных систем

### Стратегия

Sliding window с фиксированным окном:
- Счетчик сбрасывается через определенный период
- Каждый запрос увеличивает счетчик
- При превышении лимита возвращается 429 ошибка

## Конфигурация лимитов

### 1. Общие API запросы
```javascript
// 100 запросов за 15 минут на IP/пользователя
apiLimiter: {
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 100
}
```

### 2. Аутентификация
```javascript
// 5 попыток за 15 минут на IP
authLimiter: {
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5,
  skipSuccessfulRequests: true // Успешные не считаются
}
```

### 3. Поиск туров
```javascript
// 30 запросов за 5 минут на пользователя
searchLimiter: {
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 30
}
```

### 4. AI анализ
```javascript
// 10 запросов за 5 минут (дорогой ресурс)
aiLimiter: {
  windowMs: 5 * 60 * 1000, // 5 минут
  max: 10
}
```

### 5. Webhooks
```javascript
// 1000 запросов за 1 минуту (для Telegram)
webhookLimiter: {
  windowMs: 60 * 1000, // 1 минута
  max: 1000
}
```

## HTTP Headers

### Стандартные заголовки ответа

```http
RateLimit-Limit: 100
RateLimit-Remaining: 95
RateLimit-Reset: 2024-01-05T12:30:00.000Z
```

### При превышении лимита (429)

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 300

{
  "error": "Too many requests",
  "message": "Вы превысили лимит запросов. Максимум 100 запросов за 15 минут.",
  "retryAfter": 300
}
```

## Использование

### Применение к routes

```typescript
// Применить к конкретному endpoint
app.get('/api/tours', searchLimiter, toursController);

// Применить динамически ко всем API
app.use('/api', dynamicRateLimiter);
```

### Кастомные лимиты для пользователей

```typescript
// VIP пользователь с увеличенными лимитами
const vipLimiter = createUserRateLimiter('user123', {
  windowMs: 15 * 60 * 1000,
  max: 500 // 5x больше обычного
});
```

### Управление лимитами

```typescript
// Сбросить лимит для пользователя
await resetRateLimit('user:123456');

// Проверить статус
const status = await getRateLimitStatus('user:123456');
console.log(status);
// { count: 45, resetTime: Date('2024-01-05T12:30:00.000Z') }
```

## Обход для тестирования

### Отключенные endpoints

Rate limiting не применяется к:
- `/api/health` - health check
- `/metrics` - метрики Prometheus

### Тестовые заголовки

В development режиме можно использовать:
```http
X-RateLimit-Bypass: test-token
```

## Мониторинг

### Логирование

Все превышения логируются:
```
[WARN] Rate limit exceeded for IP: 192.168.1.100, Path: /api/tours
```

### Метрики

Prometheus метрики:
- `rate_limit_exceeded_total` - количество превышений
- `rate_limit_requests_total` - общее количество запросов
- `rate_limit_active_keys` - активные ключи в Redis

## Best Practices

### 1. Правильная идентификация

```typescript
keyGenerator: (req) => {
  // Приоритет: JWT user ID > Session ID > IP
  const userId = req.user?.id;
  const sessionId = req.session?.id;
  return userId || sessionId || req.ip;
}
```

### 2. Graceful degradation

```typescript
// Если Redis недоступен - логируем, но не блокируем
store: new RedisStore({
  client: redis,
  // Разрешаем запросы при ошибке Redis
  passIfNotConnected: true
})
```

### 3. Информативные сообщения

```json
{
  "error": "Too many requests",
  "message": "Превышен лимит поиска туров",
  "limit": 30,
  "windowMinutes": 5,
  "retryAfter": 180,
  "upgradeUrl": "/api/pricing"
}
```

## Настройка для production

### 1. За прокси (nginx)

```typescript
app.set('trust proxy', 1); // Доверять X-Forwarded-For
```

### 2. Распределенная система

```typescript
// Использовать общий Redis для всех инстансов
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  // Redis Cluster
  cluster: [{
    host: 'redis-1',
    port: 6379
  }, {
    host: 'redis-2',
    port: 6379
  }]
});
```

### 3. Настройка лимитов по окружению

```typescript
const limits = {
  development: { window: 15, max: 1000 },
  staging: { window: 15, max: 200 },
  production: { window: 15, max: 100 }
};

const config = limits[process.env.NODE_ENV] || limits.production;
```

## Troubleshooting

### Redis connection refused

```bash
# Проверить подключение
redis-cli ping

# Проверить конфигурацию
echo $REDIS_HOST $REDIS_PORT
```

### Лимиты срабатывают слишком часто

1. Проверить правильность определения IP за прокси
2. Убедиться что не используется общий IP (например, корпоративный NAT)
3. Проверить нет ли утечки запросов в коде клиента

### Debug mode

```typescript
// Включить подробное логирование
const debugLimiter = createRateLimiter({
  // ...
  handler: (req, res) => {
    console.log('Rate limit details:', {
      ip: req.ip,
      path: req.path,
      headers: req.headers,
      key: req.rateLimit.key
    });
    // ...
  }
});
```