# AI Travel Agent Telegram Bot

Телеграм-бот для подбора туров с интеграцией Level.Travel API и искусственным интеллектом для персонализации рекомендаций.

## Основные функции

- 🧠 **Анализ текстовых запросов** - пользователи могут писать свои пожелания свободным текстом
- ⚖️ **Система весов параметров** - настройка важности каждого критерия (звездность, линия пляжа, питание и т.д.)
- 🔄 **Фоновый мониторинг** - автоматический поиск туров с уведомлениями о подходящих предложениях
- 👥 **Групповой подбор туров** - совместный поиск с учетом предпочтений всех участников
- 🗳 **Голосование за туры** - возможность голосовать за понравившиеся варианты в группах
- ⏰ **Умные дедлайны** - предложение альтернатив после истечения срока поиска
- 🎯 **Персонализация через AI** - использование OpenRouter для анализа запросов
- 📱 **Telegram Mini App** - удобный интерфейс для детальной настройки

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
│   │   ├── callbacks.ts        # Обработчики callback-кнопок
│   │   ├── commands/           # Команды бота
│   │   ├── fsm.ts              # Конечный автомат для диалогов
│   │   ├── handlers.ts         # Обработчики сообщений
│   │   ├── notifications.ts    # Отправка уведомлений
│   │   └── utils/
│   │       └── onboarding.ts   # Модуль онбординга
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

## Настройка онбординга

Карточки и тексты онбординга можно изменить в файле `server/bot/utils/onboarding.ts`:

- `ONBOARDING_CARDS`: массив текстов для карточек онбординга (каждый элемент - отдельная карточка)
- `CARD_DELAY`: задержка между отправкой карточек (мс) для "живого" эффекта

Пример изменения текстов карточек:

```typescript
export const ONBOARDING_CARDS = [
  '🌴 Добро пожаловать в TravelAI', 
  '🤔 Я помогу найти идеальный тур для вас',
  '💡 Просто расскажите о своих предпочтениях',
  '🔍 Я подберу лучшие предложения от Level.Travel',
  '✅ Бронируйте с уверенностью, зная все детали'
];
```

## Команды бота

- `/start` - Начало работы с ботом и онбординг для новых пользователей
- `/help` - Отображение карточек онбординга и списка команд
- `/myrequests` - История запросов пользователя
- `/referral` - Получение реферальной ссылки
- `/join` - Присоединиться к групповому поиску (в групповых чатах)
- `/groupsetup` - Настроить групповой поиск туров

## Как запустить проект

### Вариант 1: Запуск с Docker (рекомендуется)

1. Скопируйте `.env.example` в `.env` и заполните переменные окружения
2. Запустите контейнеры:

```bash
# Для разработки (с UI для БД и Redis)
docker-compose -f docker-compose.dev.yml up -d

# Для продакшена
docker-compose up -d
```

Доступные интерфейсы при запуске для разработки:
- Приложение: http://localhost:5000
- Adminer (PostgreSQL UI): http://localhost:8080
- Redis Commander: http://localhost:8081
- Bull Dashboard: http://localhost:3333

### Вариант 2: Локальный запуск

1. Установите зависимости: `npm install`
2. Скопируйте `.env.example` в `.env` и заполните переменные окружения (см. раздел ниже)
3. Убедитесь что запущены PostgreSQL и Redis:
   ```bash
   # PostgreSQL (если локально)
   sudo systemctl start postgresql
   
   # Redis (если локально)
   sudo systemctl start redis
   ```
4. Инициализируйте базу данных: `npm run db:push`
5. Запустите проект: `npm run dev`

### Тестирование

```bash
# Запуск всех тестов
npm test

# Запуск тестов в режиме наблюдения
npm run test:watch

# Генерация отчета о покрытии
npm run test:coverage

# Интеграционные тесты
npm run test:integration
```

## Использование

### Для пользователей:
1. Найдите бота в Telegram и нажмите `/start`
2. Опишите желаемый тур текстом или заполните анкету
3. Настройте важность параметров через Mini App
4. Получайте уведомления о подходящих турах

### Для групп:
1. Добавьте бота в групповой чат
2. Используйте команду `/groupsetup`
3. Каждый участник заполняет свои предпочтения
4. Получайте общие рекомендации и голосуйте

## Технические особенности

### Анализ текстовых запросов
Бот понимает естественные запросы на русском языке:
- "Хочу на море в Турцию, 4 звезды, первая линия"
- "Ищу тур в Египет до 100 тысяч на двоих"
- "Семейный отдых с детьми у моря"

### Система весов
Каждый параметр оценивается от 0 до 10:
- **0** - совсем не важно
- **5** - умеренно важно
- **10** - критически важно

### Фоновый мониторинг
- Проверка новых туров каждый час
- Уведомления при соответствии от 85%
- Автоматическая деактивация после бронирования

### API Endpoints

- `GET /api/profile/:userId` - получить профиль
- `POST /api/profile` - создать/обновить профиль
- `POST /api/analyze-request` - анализ текстового запроса
- `GET /api/tours` - поиск туров
- `POST /api/group/create` - создать группу
- `POST /api/group/vote` - голосовать за тур
- `GET /api/tours/recommended/:userId` - рекомендованные туры
- `GET /api/health` - проверка состояния сервисов
- `GET /metrics` - Prometheus метрики

Полная документация API доступна по адресу `/api-docs` после запуска сервера.

## Переменные окружения

```bash
# База данных PostgreSQL
DATABASE_URL=postgresql://user:password@host:5432/database

# Telegram Bot
TELEGRAM_TOKEN=your_bot_token_from_botfather

# AI провайдеры
OPENROUTER_API_KEY=your_openrouter_api_key  # Опционально, есть fallback
YANDEX_GPT_API_KEY=                         # Опционально

# Level.Travel API
LEVELTRAVEL_API_KEY=your_leveltravel_api_key
LEVEL_TRAVEL_PARTNER=627387

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=                              # Оставьте пустым для локального Redis

# Безопасность (для продакшена сгенерируйте случайные значения)
JWT_ACCESS_SECRET=your_jwt_access_secret_here
JWT_REFRESH_SECRET=your_jwt_refresh_secret_here
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d
JWT_ISSUER=ai-travel-agent
JWT_AUDIENCE=ai-travel-agent-api

# CSRF и сессии
CSRF_SECRET=your_csrf_secret_here
COOKIE_SECRET=your_cookie_secret_here
SESSION_SECRET=your_session_secret_here

# Приложение
APP_URL=http://localhost:5000                # Для продакшена: https://yourdomain.com
NODE_ENV=development                         # production для продакшена
LOG_LEVEL=info                               # debug для подробных логов
```

### Генерация секретных ключей

Для продакшена обязательно сгенерируйте случайные секретные ключи:

```bash
# Linux/Mac
openssl rand -base64 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Требования

- Node.js 18+
- PostgreSQL 14+ (рекомендуется Neon для облачного хостинга)
- Redis 6+
- Telegram Bot Token (получить у @BotFather)
- Level.Travel API ключ (для работы с турами)
- OpenRouter API ключ (опционально, для улучшенного AI анализа)

## Безопасность

Проект включает следующие меры безопасности:
- JWT токены для аутентификации
- CSRF защита для веб-интерфейса
- Rate limiting для защиты от DDoS
- Helmet для безопасных HTTP заголовков
- Валидация всех входных данных (Zod)
- Санитизация данных от XSS атак
- Безопасное хранение секретов

## Мониторинг

- Health checks: `/api/health`
- Prometheus метрики: `/metrics`
- Structured logging с Winston
- Correlation ID для трассировки запросов
- Graceful shutdown для безопасной остановки

## Дополнительная документация

- [ARCHITECTURE.md](./ARCHITECTURE.md) - детальное описание архитектуры
- [API.md](./API.md) - документация по API endpoints
- [DEPLOYMENT.md](./DEPLOYMENT.md) - инструкции по развертыванию
- [MONITORING.md](./MONITORING.md) - настройка мониторинга
- [SECURITY.md](./SSL_SETUP.md) - настройка SSL и безопасности

## Поддержка

При возникновении проблем:
1. Проверьте логи: `docker-compose logs -f app`
2. Проверьте состояние сервисов: `curl http://localhost:5000/api/health`
3. Убедитесь, что все переменные окружения настроены правильно
4. Проверьте, что все внешние сервисы доступны (Redis, PostgreSQL)

## Лицензия

MIT