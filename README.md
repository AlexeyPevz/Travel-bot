# AI Travel Agent Telegram Bot

Телеграм-бот для подбора туров с интеграцией Level.Travel API и искусственным интеллектом для персонализации рекомендаций.

## Основные функции

- 🧠 **Анализ текстовых запросов** - пользователи могут писать свои пожелания свободным текстом
- ⚖️ **Система весов параметров** - настройка важности каждого критерия (звездность, линия пляжа, питание и т.д.)
- 🔄 **Фоновый мониторинг** - автоматический поиск туров с уведомлениями о подходящих предложениях
- 👥 **Групповой подбор туров** - совместный поиск с учетом предпочтений всех участников
- 🗳 **Голосование за туры** - возможность голосовать за понравившиеся варианты в группах
- ⏰ **Умные дедлайны** - предложение альтернатив после истечения срока поиска
- 🎯 **Персонализация через AI** - использование OpenRouter для анализа запросов (с фоллбеком на базовый парсинг)
- 📱 **Telegram Mini App** - удобный интерфейс для детальной настройки

## MVP-конфигурация

- Провайдеры: по умолчанию используется один провайдер туров — **Level.Travel** (охват 90+ ТО)
- Режим бота: поддерживаются оба режима — **webhook** и **polling** (по умолчанию polling)
- Мониторинг: часовой цикл проверки задач, уведомления при соответствии ≥ 85%

## Структура проекта

```
├── client              # Frontend на React (Telegram Mini App)
│   ├── src
│   │   ├── components  # React компоненты
│   │   ├── hooks       # Custom React hooks
│   │   ├── lib         # Утилиты и API клиент
│   │   └── pages       # Страницы приложения
├── db                  # Drizzle ORM для базы данных
│   ├── migrations      # SQL миграции
│   └── index.ts        # Подключение к БД
├── server              # Backend на Express
│   ├── bot             # Логика Telegram-бота
│   ├── config          # Конфигурационные файлы
│   ├── middleware      # Express middleware
│   ├── monitoring      # Метрики и health checks
│   ├── providers       # Провайдеры туров (Level.Travel)
│   ├── routes          # API endpoints
│   ├── services        # Бизнес-логика
│   └── validators      # Схемы валидации (Zod)
├── shared              # Общие схемы данных и типы
└── tests               # Тесты (unit и integration)
```

## Режимы работы Telegram-бота

- Polling (по умолчанию): не требует внешнего URL
- Webhook: требует публичный URL `APP_URL`

Переключение режимов:

```
TELEGRAM_USE_WEBHOOK=true
APP_URL=https://yourdomain.com
```

Webhook endpoint: `POST /api/telegram/webhook`

## Как запустить проект

### Вариант 1: Docker (рекомендуется)

1. Скопируйте `.env.example` в `.env` и заполните переменные окружения
2. Запустите контейнеры:

```bash
# Для разработки (с UI для БД и Redis)
docker-compose -f docker-compose.dev.yml up -d

# Для продакшена
docker-compose up -d
```

Доступные интерфейсы в dev:
- Приложение: http://localhost:5000
- Adminer (PostgreSQL UI): http://localhost:8080
- Redis Commander: http://localhost:8081

### Вариант 2: Локально

1. `npm install`
2. Настройте `.env`
3. Поднимите PostgreSQL и Redis
4. `npm run db:push`
5. `npm run dev`

### Тестирование

```bash
npm test
npm run test:integration
```

## API Endpoints (основные)

- `GET /api/profile/:userId`
- `POST /api/profile`
- `POST /api/analyze-request`
- `GET /api/tours`
- `POST /api/group/create`
- `POST /api/group/vote`
- `GET /api/health`
- `GET /metrics`
- `POST /api/telegram/webhook` (если включён webhook)

## Переменные окружения (MVP)

```bash
# БД
DATABASE_URL=postgresql://user:password@host:5432/database

# Telegram
TELEGRAM_TOKEN=your_bot_token
TELEGRAM_USE_WEBHOOK=false           # true для webhook
APP_URL=https://yourdomain.com       # обязателен для webhook

# AI (опционально)
OPENROUTER_API_KEY=

# Level.Travel
LEVELTRAVEL_API_KEY=your_leveltravel_api_key
LEVEL_TRAVEL_PARTNER=627387
LEVEL_TRAVEL_MARKER=marker
LEVEL_TRAVEL_AFFILIATE_URL=https://example.com/aff

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT/CSRF/Сессии
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
JWT_ISSUER=ai-travel-agent
JWT_AUDIENCE=ai-travel-agent-api
CSRF_SECRET=...
COOKIE_SECRET=...
SESSION_SECRET=...

# App
APP_URL=http://localhost:5000
NODE_ENV=development
LOG_LEVEL=info
```

## Безопасность и Observability (MVP)

- JWT, CSRF, Helmet, Rate limiting, Zod
- Метрики Prometheus: `/metrics`, `/api/health`
- Логи Winston c correlation ID
- Graceful shutdown

## Продчек‑лист для MVP

- Level.Travel: таймауты, ретраи, кэш, аффилиат ссылки
- Бот: включить webhook в проде; задать `APP_URL`
- Мониторинг: алерты на деградацию провайдера, ошибки 5xx, время ответа
- Бэкапы Postgres/Redis; секреты в переменных окружения/secret‑store

## Дополнительно

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [API.md](./API.md)
- [DEPLOYMENT.md](./DEPLOYMENT.md)
- [MONITORING.md](./MONITORING.md)
- [SSL_SETUP.md](./SSL_SETUP.md)