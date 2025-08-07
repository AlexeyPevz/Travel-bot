# Быстрый запуск AI Travel Agent

## Текущее состояние проекта

### ✅ Что готово:

1. **Базовая архитектура**
   - Telegram бот с FSM (конечный автомат состояний)
   - REST API с документацией Swagger
   - База данных PostgreSQL с Drizzle ORM
   - Интеграция с Level.Travel API
   - AI анализ текстовых запросов через OpenRouter

2. **Функционал для пользователей**
   - Регистрация и онбординг
   - Анализ текстовых запросов на естественном языке
   - Система весов для персонализации
   - Поиск туров с фильтрацией
   - Фоновый мониторинг цен
   - Групповой подбор туров

3. **Безопасность**
   - JWT аутентификация
   - CSRF защита
   - Rate limiting
   - Валидация данных

### ⚠️ Что требуется для запуска:

1. **API ключи**:
   - `TELEGRAM_TOKEN` - токен бота от @BotFather (обязательно)
   - `LEVELTRAVEL_API_KEY` - ключ API Level.Travel (обязательно для поиска туров)
   - `OPENROUTER_API_KEY` - для AI анализа (опционально, есть fallback)

2. **Сервисы**:
   - PostgreSQL
   - Redis

## Инструкция по запуску

### Вариант 1: Docker (рекомендуется)

```bash
# 1. Клонируйте репозиторий
git clone <your-repo>
cd travel-agent

# 2. Создайте .env файл
cp .env.example .env

# 3. Отредактируйте .env и добавьте:
# - TELEGRAM_TOKEN (получите от @BotFather)
# - LEVELTRAVEL_API_KEY (запросите у Level.Travel)
# - OPENROUTER_API_KEY (опционально)

# 4. Запустите через Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# 5. Проверьте логи
docker-compose -f docker-compose.dev.yml logs -f app
```

### Вариант 2: Локальный запуск

```bash
# 1. Установите зависимости
npm install

# 2. Настройте базу данных PostgreSQL
# Создайте базу данных travel_db или измените DATABASE_URL в .env

# 3. Запустите Redis
# Ubuntu/Debian: sudo systemctl start redis
# macOS: brew services start redis
# Windows: используйте Docker или WSL

# 4. Создайте .env файл
cp .env.example .env
# Отредактируйте и добавьте ключи

# 5. Инициализируйте базу данных
npm run db:push

# 6. Запустите проект
npm run dev
```

## Проверка работоспособности

### 1. API
- Откройте http://localhost:5000/api-docs - должна открыться документация Swagger
- Проверьте здоровье: http://localhost:5000/api/health

### 2. Telegram бот
- Найдите вашего бота в Telegram
- Отправьте команду `/start`
- Бот должен ответить приветствием и показать онбординг

### 3. Тестовый поиск
Попробуйте отправить боту:
- "Хочу в Турцию на море, все включено"
- "Ищу тур в Египет до 100 тысяч"
- "Семейный отдых с детьми"

## Минимальный тест Level.Travel API

```bash
# Проверка работы API
node test-leveltravel.js
```

## Возможные проблемы

### 1. Ошибка подключения к БД
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```
**Решение**: Убедитесь, что PostgreSQL запущен и DATABASE_URL корректный

### 2. Ошибка Redis
```
Error: Redis connection to localhost:6379 failed
```
**Решение**: Запустите Redis или используйте Docker

### 3. Telegram webhook
```
Error: 409: Conflict: can't use getUpdates method
```
**Решение**: Это нормально для локальной разработки, бот использует polling

### 4. Level.Travel API не работает
```
Error: 401 Unauthorized
```
**Решение**: Проверьте LEVELTRAVEL_API_KEY в .env

## Дальнейшие шаги

После успешного запуска базового функционала:

1. **Оптимизация поиска**
   - Настройте кеширование результатов
   - Добавьте больше фильтров

2. **Расширение провайдеров**
   - Подключите другие туристические API
   - Реализуйте агрегацию результатов

3. **Улучшение AI**
   - Обучите модель на ваших данных
   - Добавьте многоагентную систему

4. **Монетизация**
   - Настройте партнерские ссылки
   - Добавьте премиум функции

## Контакты для поддержки

- Документация API: `/api-docs`
- Логи: `docker-compose logs -f`
- Метрики: http://localhost:5000/metrics