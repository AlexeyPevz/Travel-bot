# Monitoring & Observability Guide

## Обзор

Проект использует комплексную систему мониторинга, построенную на базе Prometheus Stack для обеспечения полной observability приложения.

## Архитектура мониторинга

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Application   │────▶│   Prometheus    │────▶│     Grafana     │
│    Metrics      │     │  (Time Series)  │     │ (Visualization) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                         │
         │              ┌─────────────────┐               │
         │              │  AlertManager   │               │
         │              │    (Alerts)     │               │
         │              └─────────────────┘               │
         │                                                │
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│     Logs        │────▶│      Loki       │────▶│     Grafana     │
│  (Application)  │     │ (Log Storage)   │     │  (Log Viewer)   │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       ▲
         │                       │
         └──────────────▶ Promtail ◀──────────────┐
                        (Log Collector)            │
                                                  │
┌─────────────────┐                      ┌─────────────────┐
│     Traces      │─────────────────────▶│     Jaeger      │
│  (Application)  │                      │ (Trace Storage) │
└─────────────────┘                      └─────────────────┘
```

## Компоненты

### 1. Prometheus
- **Назначение**: Сбор и хранение метрик
- **Порт**: 9090
- **Интервал сбора**: 15s
- **Retention**: 15 дней (по умолчанию)

### 2. Grafana
- **Назначение**: Визуализация метрик и логов
- **Порт**: 3001
- **Дашборды**: Предустановленные для всех компонентов
- **Доступ**: admin/admin (изменить при первом входе)

### 3. AlertManager
- **Назначение**: Управление алертами
- **Порт**: 9093
- **Группировка**: По severity и team
- **Каналы**: Email, Slack, Telegram

### 4. Loki & Promtail
- **Назначение**: Сбор и хранение логов
- **Порт Loki**: 3100
- **Источники**: Application logs, Docker logs, System logs

### 5. Jaeger
- **Назначение**: Distributed tracing
- **UI порт**: 16686
- **Сбор**: OpenTelemetry protocol

## Метрики приложения

### HTTP метрики
```
# Длительность запросов
travelbot_http_request_duration_seconds{method, route, status, status_code}

# Количество запросов
travelbot_http_requests_total{method, route, status, status_code}

# Размер запросов/ответов
travelbot_http_request_size_bytes{method, route}
travelbot_http_response_size_bytes{method, route}
```

### Bot метрики
```
# Обработанные сообщения
travelbot_bot_messages_total{type, command, status, chat_type}

# Длительность команд
travelbot_bot_command_duration_seconds{command, status}

# Активные чаты
travelbot_bot_active_chats{type}
```

### AI метрики
```
# AI запросы
travelbot_ai_requests_total{provider, model, operation, status}
travelbot_ai_request_duration_seconds{provider, model, operation, status}

# Использование токенов
travelbot_ai_tokens_used_total{provider, model, type}

# Fallback попытки
travelbot_ai_fallback_attempts_total{from_provider, to_provider, reason}
```

### Бизнес метрики
```
# Поиски туров
travelbot_tour_searches_total{destination, provider, status}
travelbot_tour_search_results_count{destination, provider}

# Пользователи
travelbot_active_users{time_range}
travelbot_user_registrations_total{source}

# Бронирования и рефералы
travelbot_bookings_total{status, destination}
travelbot_referrals_total{status}
```

## Алерты

### Критические алерты
- `ServiceDown`: Сервис недоступен более 2 минут
- `AllAIProvidersDown`: Все AI провайдеры не работают
- `CriticalErrorRate`: Критические ошибки > 1%
- `UnhandledExceptions`: Необработанные исключения

### Предупреждения
- `HighErrorRate`: Ошибки > 5%
- `HighResponseTime`: 95 перцентиль > 3s
- `AIProviderFailures`: Отказы AI > 30%
- `LowCacheHitRate`: Cache hit < 50%
- `QueueBacklog`: Очередь > 1000 задач

## Запуск мониторинга

### 1. Локальная разработка
```bash
# Запуск только мониторинга
docker-compose -f docker-compose.monitoring.yml up -d

# Запуск с приложением
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

### 2. Production
```bash
# С полным стеком
docker-compose \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  -f docker-compose.monitoring.yml \
  up -d
```

## Доступ к интерфейсам

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001
- **AlertManager**: http://localhost:9093
- **Jaeger**: http://localhost:16686

## Настройка Grafana

### 1. Источники данных
Автоматически настроены через provisioning:
- Prometheus (метрики)
- Loki (логи)
- Jaeger (трейсы)

### 2. Дашборды

#### Application Dashboard
- HTTP метрики (RPS, latency, errors)
- Bot метрики (команды, пользователи)
- AI метрики (запросы, токены, fallbacks)
- Бизнес метрики (поиски, бронирования)

#### Infrastructure Dashboard
- CPU/Memory использование
- Disk I/O
- Network traffic
- Container метрики

#### AI Performance Dashboard
- Провайдеры и модели
- Успешность запросов
- Использование токенов
- Fallback статистика

## Интеграция в код

### 1. Отслеживание HTTP запросов
```typescript
// Автоматически через middleware
app.use(metricsMiddleware);
```

### 2. Отслеживание операций
```typescript
import { trackAsyncOperation, dbQueryDuration } from './monitoring/metrics';

// Отслеживание DB запроса
await trackAsyncOperation(
  dbQueryDuration,
  { operation: 'select', table: 'users' },
  async () => {
    return await db.select().from(users);
  }
);
```

### 3. Отслеживание ошибок
```typescript
import { trackError } from './monitoring/metrics';

try {
  // операция
} catch (error) {
  trackError('database', error.code, 'user-service', 'critical');
  throw error;
}
```

### 4. Бизнес метрики
```typescript
import { tourSearchTotal, tourSearchResults } from './monitoring/metrics';

// После поиска
tourSearchTotal.inc({ 
  destination: 'Turkey', 
  provider: 'leveltravel', 
  status: 'success' 
});

tourSearchResults.observe(
  { destination: 'Turkey', provider: 'leveltravel' },
  results.length
);
```

## Оптимизация производительности

### 1. Метрики с высокой кардинальностью
Избегайте метрик с неограниченными значениями labels:
```typescript
// ❌ Плохо
httpRequestTotal.inc({ user_id: userId });

// ✅ Хорошо
httpRequestTotal.inc({ user_type: isPremium ? 'premium' : 'free' });
```

### 2. Гистограммы
Используйте правильные buckets:
```typescript
new Histogram({
  name: 'api_duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10] // Подходящие для вашего SLA
});
```

### 3. Сэмплирование
Для высоконагруженных эндпоинтов используйте сэмплирование:
```typescript
if (Math.random() < 0.1) { // 10% сэмплирование
  trackDetailedMetrics();
}
```

## Troubleshooting

### Prometheus не собирает метрики
1. Проверьте endpoint: `curl http://localhost:3000/metrics`
2. Проверьте targets в Prometheus UI
3. Проверьте network connectivity

### Высокое использование памяти
1. Уменьшите retention период
2. Оптимизируйте кардинальность метрик
3. Включите downsampling для старых данных

### Алерты не отправляются
1. Проверьте AlertManager config
2. Проверьте webhook endpoints
3. Смотрите логи AlertManager

## Best Practices

1. **Называйте метрики правильно**
   - Используйте префикс приложения
   - Добавляйте unit в название
   - Следуйте конвенциям Prometheus

2. **Документируйте метрики**
   - Добавляйте help текст
   - Описывайте labels
   - Указывайте единицы измерения

3. **Мониторьте то, что важно**
   - SLI (Service Level Indicators)
   - Бизнес метрики
   - Пользовательский опыт

4. **Настройте правильные алерты**
   - Алертите на симптомы, не причины
   - Избегайте alert fatigue
   - Тестируйте алерты

5. **Регулярно ревьюйте**
   - Удаляйте неиспользуемые метрики
   - Обновляйте дашборды
   - Оптимизируйте запросы