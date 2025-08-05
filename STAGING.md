# Staging Environment Guide

## Обзор

Staging окружение - это полная копия production окружения для тестирования новых функций перед релизом. Оно изолировано от production и использует отдельные базы данных, API ключи и конфигурации.

## Архитектура Staging

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Production    │     │     Staging     │     │   Development   │
│  (port 5000)    │     │   (port 5001)   │     │  (port 5000)    │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│ PostgreSQL:5432 │     │ PostgreSQL:5433 │     │ PostgreSQL:5432 │
│ Redis:6379      │     │ Redis:6380      │     │ Redis:6379      │
│ Nginx:80/443    │     │ Nginx:8080      │     │ No Nginx        │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Быстрый старт

### 1. Локальный запуск staging

```bash
# Копируем переменные окружения
cp .env.staging.example .env.staging

# Запускаем staging окружение
docker-compose -f docker-compose.staging.yml up -d

# Проверяем статус
docker-compose -f docker-compose.staging.yml ps

# Смотрим логи
docker-compose -f docker-compose.staging.yml logs -f app-staging
```

### 2. Доступ к staging

- **Приложение**: http://localhost:5001 или http://staging.localhost:8080
- **База данных**: localhost:5433
- **Redis**: localhost:6380
- **Prometheus**: http://localhost:9091 (с профилем monitoring)
- **Grafana**: http://localhost:3002 (с профилем monitoring)

## Настройка

### Переменные окружения

Все staging переменные имеют префикс `STAGING_`:

```env
# Основные
STAGING_DATABASE_URL=postgresql://...
STAGING_TELEGRAM_TOKEN=...
STAGING_APP_URL=http://staging.yourdomain.com

# Feature flags
ENABLE_EXPERIMENTAL_FEATURES=true
ENABLE_DEBUG_MODE=true
```

### Отдельный Telegram бот

1. Создайте нового бота через @BotFather
2. Назовите его с суффиксом `_staging`
3. Добавьте токен в `STAGING_TELEGRAM_TOKEN`

### База данных

Staging использует отдельную БД с суффиксом `_staging`:

```sql
-- Создание staging БД
CREATE DATABASE tourtinder_staging;
CREATE USER tourtinder_staging WITH PASSWORD 'staging123';
GRANT ALL PRIVILEGES ON DATABASE tourtinder_staging TO tourtinder_staging;
```

## Деплой в staging

### Автоматический деплой

1. **Через GitHub Actions**:
   ```
   Actions → Deploy to Production → Run workflow → Environment: staging
   ```

2. **При push в develop branch** (если настроено):
   ```bash
   git push origin develop
   ```

### Ручной деплой

```bash
# На staging сервере
cd /home/deploy/staging

# Обновляем код
git pull origin develop

# Пересобираем и запускаем
docker-compose -f docker-compose.staging.yml build
docker-compose -f docker-compose.staging.yml up -d

# Запускаем миграции
docker-compose -f docker-compose.staging.yml exec app-staging npm run db:migrate
```

## Feature Flags

В staging включены дополнительные возможности:

### 1. Debug endpoints

```bash
# Информация о системе
GET /debug/info

# Состояние кешей
GET /debug/cache

# Активные сессии
GET /debug/sessions

# Конфигурация (без секретов)
GET /debug/config
```

### 2. Test endpoints

```bash
# Генерация тестовых данных
POST /api/test/generate-users
POST /api/test/generate-tours

# Очистка данных
POST /api/test/reset-database

# Симуляция ошибок
POST /api/test/trigger-error?type=500
```

### 3. Swagger UI

Доступен по адресу: http://staging.yourdomain.com/api-docs

## Тестирование

### Автоматические тесты

```bash
# Запуск тестов против staging
STAGING_URL=http://localhost:5001 npm run test:e2e

# Тесты производительности
npm run test:performance -- --url http://localhost:5001
```

### Ручное тестирование

1. **Smoke tests** - базовая проверка работоспособности
2. **Feature tests** - тестирование новых функций
3. **Integration tests** - проверка интеграций
4. **Load tests** - нагрузочное тестирование

### Чеклист тестирования

- [ ] Регистрация/вход работает
- [ ] Поиск туров возвращает результаты
- [ ] Telegram бот отвечает
- [ ] WebApp открывается
- [ ] API endpoints доступны
- [ ] Метрики собираются
- [ ] Логи пишутся

## Мониторинг staging

### Метрики

```bash
# Prometheus запросы
http_requests_total{env="staging"}
error_rate{env="staging"}
response_time_histogram{env="staging"}
```

### Логи

```bash
# Просмотр логов
docker-compose -f docker-compose.staging.yml logs -f app-staging

# Фильтрация ошибок
docker-compose -f docker-compose.staging.yml logs app-staging | grep ERROR

# Экспорт логов
docker-compose -f docker-compose.staging.yml logs > staging-logs.txt
```

### Алерты

Настройте отдельные алерты для staging:
- Высокий error rate (> 5%)
- Долгий response time (> 1s)
- Падение сервиса
- Ошибки деплоя

## Данные в staging

### Тестовые данные

```bash
# Генерация через seed скрипт
docker-compose -f docker-compose.staging.yml exec app-staging npm run db:seed

# Параметры seed
STAGING_TEST_USER_COUNT=10
STAGING_TEST_TOUR_COUNT=100
```

### Копирование из production

**ВАЖНО**: Анонимизируйте данные!

```bash
# Дамп production БД
pg_dump production_db > prod_dump.sql

# Анонимизация
./scripts/anonymize-dump.sh prod_dump.sql > staging_dump.sql

# Восстановление в staging
psql staging_db < staging_dump.sql
```

## Безопасность staging

### Ограничения доступа

1. **Basic Auth** для веб-интерфейса:
   ```nginx
   auth_basic "Staging Environment";
   auth_basic_user_file /etc/nginx/.htpasswd;
   ```

2. **IP whitelist** для критичных endpoints:
   ```nginx
   location /debug/ {
       allow 10.0.0.0/8;
       deny all;
   }
   ```

3. **Отдельные API ключи** - никогда не используйте production ключи

### Изоляция

- Отдельная сеть Docker
- Отдельные volumes
- Отдельные порты
- Отдельный домен/поддомен

## Отличия от Production

| Параметр | Production | Staging |
|----------|------------|---------|
| Порт | 5000 | 5001 |
| БД порт | 5432 | 5433 |
| Redis порт | 6379 | 6380 |
| Log level | info | debug |
| Rate limits | Строгие | Мягкие |
| Debug endpoints | Отключены | Включены |
| Swagger UI | Отключен | Включен |
| Error details | Скрыты | Показаны |

## Troubleshooting

### "Port already in use"

```bash
# Проверяем занятые порты
lsof -i :5001
lsof -i :5433

# Останавливаем конфликтующие сервисы
docker-compose -f docker-compose.staging.yml down
```

### "Database connection failed"

```bash
# Проверяем доступность БД
docker-compose -f docker-compose.staging.yml exec postgres-staging pg_isready

# Пересоздаем БД
docker-compose -f docker-compose.staging.yml down -v
docker-compose -f docker-compose.staging.yml up -d
```

### "Telegram bot not responding"

1. Проверьте отдельный токен для staging бота
2. Убедитесь что webhook настроен на staging URL
3. Проверьте логи бота

## Best Practices

1. **Всегда тестируйте в staging** перед production деплоем
2. **Используйте отдельные credentials** для всех сервисов
3. **Регулярно синхронизируйте** с production (структура БД)
4. **Автоматизируйте тесты** для staging
5. **Мониторьте staging** как production
6. **Документируйте отличия** от production
7. **Ограничивайте доступ** к staging окружению

## Переход staging → production

1. Все тесты прошли в staging
2. Код прошел review
3. Создан PR из develop в main
4. Обновлены миграции если нужно
5. Подготовлен rollback план
6. Уведомлена команда о деплое