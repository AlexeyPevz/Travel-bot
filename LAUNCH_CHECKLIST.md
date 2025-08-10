# 🚀 Чек-лист запуска AI Travel Agent

## День 1: Финальная подготовка

### 1. Настройка production окружения (2-3 часа)
- [ ] Арендовать VPS (рекомендую: 4 CPU, 8GB RAM, 100GB SSD)
- [ ] Установить Docker и Docker Compose
- [ ] Настроить домен и SSL сертификаты (Let's Encrypt)
- [ ] Настроить файрвол (открыть только 80, 443, 22)

### 2. Переменные окружения (1 час)
- [ ] Скопировать `.env.example` в `.env`
- [ ] Получить production API ключи:
  - [ ] Level.Travel API (https://api.level.travel/docs)
  - [ ] OpenRouter API (опционально)
  - [ ] Telegram Bot Token (от @BotFather)
- [ ] Сгенерировать секреты:
  ```bash
  # JWT секреты
  openssl rand -base64 32  # для JWT_ACCESS_SECRET
  openssl rand -base64 32  # для JWT_REFRESH_SECRET
  
  # Другие секреты
  openssl rand -base64 32  # для CSRF_SECRET
  openssl rand -base64 32  # для COOKIE_SECRET
  openssl rand -base64 32  # для SESSION_SECRET
  openssl rand -base64 32  # для ENCRYPTION_KEY
  ```

### 3. База данных (30 мин)
- [ ] Запустить PostgreSQL через docker-compose
- [ ] Выполнить миграции:
  ```bash
  docker-compose exec app npm run db:push
  docker-compose exec app npm run db:migrate
  ```
- [ ] Создать индексы производительности:
  ```bash
  docker-compose exec postgres psql -U $DB_USER -d $DB_NAME -f /migrations/0002_add_performance_indexes.sql
  ```

### 4. Telegram Bot (1 час)
- [ ] Настроить команды в @BotFather:
  ```
  start - Начать работу с ботом
  profile - Мой профиль
  search - Поиск туров
  help - Помощь
  settings - Настройки
  monitoring - Фоновый поиск
  ```
- [ ] Установить описание и аватар бота
- [ ] Настроить Telegram WebApp:
  - [ ] Menu Button URL: https://yourdomain.com
  - [ ] Включить Inline Mode (опционально)

### 5. Запуск в production (30 мин)
```bash
# Клонировать репозиторий
git clone <your-repo>
cd ai-travel-agent

# Запустить production версию
docker-compose -f docker-compose.production.yml up -d

# Проверить логи
docker-compose logs -f

# Проверить health endpoints
curl https://yourdomain.com/health
curl https://yourdomain.com/api/health
```

## День 2: Тестирование и мониторинг

### 6. Smoke тесты (1 час)
- [ ] Протестировать команду /start
- [ ] Создать профиль пользователя
- [ ] Выполнить поиск туров
- [ ] Проверить WebApp
- [ ] Протестировать групповой поиск
- [ ] Проверить фоновый мониторинг

### 7. Мониторинг (1 час)
- [ ] Настроить Grafana dashboards:
  ```bash
  # Импортировать dashboards из /monitoring/grafana/
  - API Performance Dashboard
  - Bot Metrics Dashboard
  - System Resources Dashboard
  ```
- [ ] Настроить алерты:
  - [ ] CPU > 80%
  - [ ] Memory > 80%
  - [ ] Error rate > 1%
  - [ ] Response time > 500ms
  - [ ] Disk space < 20%

### 8. Backup стратегия (30 мин)
- [ ] Настроить ежедневный backup БД:
  ```bash
  # Добавить в crontab
  0 3 * * * docker-compose exec postgres pg_dump -U $DB_USER $DB_NAME | gzip > /backups/db_$(date +\%Y\%m\%d).sql.gz
  ```
- [ ] Настроить ротацию логов
- [ ] Проверить backup/restore процедуру

### 9. Безопасность (30 мин)
- [ ] Проверить HTTPS работает корректно
- [ ] Убедиться что все секреты в переменных окружения
- [ ] Проверить rate limiting работает
- [ ] Просканировать на уязвимости:
  ```bash
  npm audit
  docker scan ai-travel-agent:latest
  ```

## Soft Launch (Мягкий запуск)

### 10. Первые пользователи (День 3-7)
- [ ] Запустить с 10-20 друзьями/знакомыми
- [ ] Собрать обратную связь
- [ ] Исправить критические баги
- [ ] Оптимизировать UX по фидбеку

### 11. Маркетинг подготовка
- [ ] Создать landing page
- [ ] Подготовить скриншоты/видео
- [ ] Написать пресс-релиз
- [ ] Подготовить ответы на FAQ

### 12. Аналитика
- [ ] Подключить Google Analytics
- [ ] Настроить цели и события
- [ ] Настроить отслеживание конверсий
- [ ] Интегрировать с партнерской программой Level.Travel

## Метрики успеха первой недели

**Технические:**
- ✓ Uptime > 99%
- ✓ Среднее время ответа < 300ms
- ✓ Ошибок < 0.1%

**Бизнес:**
- ✓ 100+ активных пользователей
- ✓ 500+ поисковых запросов
- ✓ 10+ переходов к бронированию
- ✓ NPS > 8

## После успешного запуска

1. **Масштабирование (Неделя 2-4)**
   - Добавить больше провайдеров туров
   - Интегрировать платежи/рассрочку
   - Добавить push-уведомления

2. **Монетизация (Месяц 2)**
   - Премиум подписка для продвинутых функций
   - B2B решение для турагентств
   - Рекламные интеграции

3. **Рост (Месяц 3+)**
   - SEO оптимизация
   - Партнерства с travel-блогерами
   - Реферальная программа
   - Интеграция с другими мессенджерами

## Контакты поддержки

- Telegram поддержка: @your_support_bot
- Email: support@yourdomain.com
- Документация: https://docs.yourdomain.com

---

**Помните:** Лучше запустить хороший MVP сегодня, чем идеальный продукт через полгода! 🚀