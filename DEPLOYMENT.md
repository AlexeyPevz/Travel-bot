# Deployment Guide

## Обзор

Проект использует автоматический CI/CD pipeline через GitHub Actions для деплоя в production и staging окружения.

## Архитектура деплоя

```
GitHub Push → CI/CD Pipeline → Docker Registry → Production Server
     ↓                ↓                              ↓
   Tests         Build Image                   Pull & Deploy
```

## Настройка GitHub Secrets

Необходимо настроить следующие секреты в GitHub repository settings:

### Обязательные секреты

```yaml
# SSH и сервер
DEPLOY_SSH_KEY        # Приватный SSH ключ для доступа к серверу
DEPLOY_HOST          # IP или домен сервера (например: 123.45.67.89)
DEPLOY_USER          # Пользователь SSH (например: deploy)
DEPLOY_PATH          # Путь на сервере (например: /home/deploy/app)

# База данных
DATABASE_URL         # PostgreSQL connection string

# API ключи
TELEGRAM_TOKEN       # Токен Telegram бота
OPENROUTER_API_KEY   # Ключ OpenRouter API
LEVELTRAVEL_API_KEY  # Ключ Level.Travel API

# Безопасность
JWT_SECRET          # Секрет для JWT токенов (32+ символа)
SESSION_SECRET      # Секрет для сессий (32+ символа)
CSRF_SECRET         # Секрет для CSRF защиты (32+ символа)
REDIS_PASSWORD      # Пароль Redis

# Опционально
SLACK_WEBHOOK       # Webhook для уведомлений в Slack
```

### Environment Variables (не секреты)

```yaml
# Настройки окружения
NODE_ENV: production
APP_URL: https://your-domain.com
LEVEL_TRAVEL_PARTNER: 627387

# Redis
REDIS_HOST: redis
REDIS_PORT: 6379

# Логирование
LOG_LEVEL: info
ENABLE_METRICS: true

# Rate limiting
RATE_LIMIT_MAX: 100
RATE_LIMIT_WINDOW_MS: 900000

# Миграции
RUN_MIGRATIONS: true
```

## Подготовка сервера

### 1. Установка Docker

```bash
# Обновляем пакеты
sudo apt update && sudo apt upgrade -y

# Устанавливаем Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Устанавливаем Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Добавляем пользователя в группу docker
sudo usermod -aG docker $USER
```

### 2. Создание пользователя для деплоя

```bash
# Создаем пользователя
sudo adduser deploy

# Добавляем в группу docker
sudo usermod -aG docker deploy

# Настраиваем SSH доступ
sudo su - deploy
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Добавляем публичный ключ
echo "ваш_публичный_ssh_ключ" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 3. Настройка директорий

```bash
# Создаем директорию для приложения
sudo mkdir -p /home/deploy/app
sudo chown -R deploy:deploy /home/deploy/app

# Создаем директории для данных
sudo mkdir -p /var/lib/app/{postgres,redis,ssl}
sudo chown -R deploy:deploy /var/lib/app
```

### 4. Настройка firewall

```bash
# Разрешаем SSH
sudo ufw allow 22/tcp

# Разрешаем HTTP и HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Включаем firewall
sudo ufw enable
```

## Процесс деплоя

### Автоматический деплой

1. **При push в main** - автоматически запускается деплой в production
2. **Ручной деплой** - через GitHub Actions → Run workflow

### Этапы деплоя

1. **Тесты** - запускаются unit и integration тесты
2. **Сборка** - создается production build
3. **Docker образ** - собирается и публикуется в GitHub Container Registry
4. **Деплой** - образ загружается на сервер и запускается
5. **Health check** - проверяется работоспособность
6. **Rollback** - при ошибке автоматический откат

### Ручной деплой

```bash
# SSH на сервер
ssh deploy@your-server.com

# Переход в директорию
cd /home/deploy/app

# Обновление и перезапуск
docker-compose pull
docker-compose up -d

# Проверка логов
docker-compose logs -f app
```

## Мониторинг деплоя

### GitHub Actions

- Статус: Actions → Workflows → Deploy to Production
- Логи: Клик на конкретный run → Jobs → Deploy

### На сервере

```bash
# Статус контейнеров
docker-compose ps

# Логи приложения
docker-compose logs -f app

# Здоровье приложения
curl http://localhost:5000/api/health

# Использование ресурсов
docker stats
```

## Rollback

### Автоматический rollback

При неудачном деплое автоматически:
1. Останавливается новая версия
2. Восстанавливается предыдущая из backup
3. Отправляется уведомление

### Ручной rollback

```bash
# На сервере
cd /home/deploy/app

# Восстановление из backup
docker-compose down
mv docker-compose.backup.yml docker-compose.yml
docker-compose up -d
```

### Rollback к конкретной версии

```bash
# Список доступных версий
docker images ghcr.io/your-org/your-repo

# Переключение на версию
export IMAGE_TAG=ghcr.io/your-org/your-repo:v1.2.3
docker-compose up -d
```

## Staging окружение

### Настройка

1. Создайте environment в GitHub: Settings → Environments → New environment → "staging"
2. Добавьте специфичные переменные для staging
3. Настройте отдельный сервер или namespace

### Деплой в staging

```yaml
# Через GitHub Actions
Actions → Deploy to Production → Run workflow → Environment: staging
```

## Blue-Green деплой (опционально)

Для zero-downtime деплоя:

```nginx
# nginx.conf
upstream app {
    server blue:5000 weight=100;
    server green:5000 weight=0;
}
```

Процесс:
1. Деплой новой версии в green
2. Постепенное переключение трафика
3. Отключение blue после проверки

## Troubleshooting

### "Health check failed"

```bash
# Проверьте логи
docker-compose logs app | tail -50

# Проверьте переменные окружения
docker-compose exec app env | grep -E "(NODE_ENV|DATABASE_URL)"

# Проверьте подключение к БД
docker-compose exec app npm run db:migrate
```

### "Permission denied"

```bash
# Проверьте права на директории
ls -la /home/deploy/app

# Проверьте членство в группе docker
groups deploy
```

### "Image pull failed"

```bash
# Проверьте доступ к registry
docker login ghcr.io -u USERNAME -p GITHUB_TOKEN

# Проверьте название образа
docker pull ghcr.io/your-org/your-repo:main
```

## Мониторинг после деплоя

### Метрики для отслеживания

- Response time: < 200ms (p95)
- Error rate: < 1%
- CPU usage: < 80%
- Memory usage: < 80%
- Disk space: > 20% free

### Алерты

Настройте алерты для:
- Неудачных деплоев
- Высокого error rate после деплоя
- Недоступности сервиса
- Превышения лимитов ресурсов

## Best Practices

1. **Всегда тестируйте в staging** перед production
2. **Используйте feature flags** для постепенного включения функций
3. **Мониторьте метрики** после каждого деплоя
4. **Храните backups** минимум 3 последних версий
5. **Документируйте изменения** в CHANGELOG
6. **Используйте semantic versioning** для тегов
7. **Автоматизируйте все** что можно автоматизировать

## Чеклист перед деплоем

- [ ] Все тесты проходят
- [ ] Код прошел review
- [ ] Обновлен CHANGELOG
- [ ] Проверены миграции БД
- [ ] Обновлены переменные окружения
- [ ] Настроен мониторинг
- [ ] Подготовлен план отката
- [ ] Уведомлена команда