# 🚀 Развертывание AI Travel Agent на VPS Beget

## 📊 Требования к ресурсам

### Минимальные требования для VPS:
- **CPU**: 1 vCPU (рекомендуется 2 vCPU)
- **RAM**: 1 GB (рекомендуется 2 GB)
- **Диск**: 10 GB SSD
- **ОС**: Ubuntu 20.04+ или Debian 10+

### Потребление ресурсов приложением:

#### В режиме простоя:
- **CPU**: 1-3%
- **RAM**: ~150-200 MB (Node.js + Redis)
- **Сеть**: минимальная (keep-alive для Telegram)

#### При активной нагрузке (10-20 пользователей):
- **CPU**: 10-20%
- **RAM**: ~300-400 MB
- **Сеть**: ~1-5 Mbps (API запросы)

#### При пиковой нагрузке (50+ пользователей):
- **CPU**: 30-50%
- **RAM**: ~500-700 MB
- **Сеть**: ~5-10 Mbps

## 📈 Производительность и масштабирование

### Текущие возможности:

#### 1. **Telegram Bot**
- **Одновременные пользователи**: 100-200 (на минимальном VPS)
- **Сообщения в секунду**: ~50-100
- **Ограничения**: Telegram API limits (30 сообщений/сек на чат)

#### 2. **Web API (Mini App)**
- **RPS (запросов/сек)**: ~100-200 на минимальном VPS
- **Одновременные соединения**: ~500-1000
- **Время ответа**: 50-200ms (зависит от кеширования)

#### 3. **База данных (PostgreSQL)**
- **Соединения**: до 100 (настраивается в Neon)
- **Запросы/сек**: ~500-1000
- **Размер БД**: начальный ~10MB, рост ~1MB/1000 пользователей

#### 4. **Redis кеш**
- **Операций/сек**: ~10,000+
- **Память**: ~50-100MB (настраивается)
- **TTL кеша**: 5-60 минут

### Узкие места:
1. **API Level.Travel**: лимиты и скорость ответа
2. **OpenRouter API**: квоты и тарифы
3. **Сеть VPS**: пропускная способность
4. **CPU**: при обработке больших результатов поиска

## 🛠️ Инструкция по развертыванию на Beget

### 1. Подготовка VPS

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка необходимых пакетов
sudo apt install -y git curl build-essential

# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PM2 для управления процессами
sudo npm install -g pm2

# Установка и настройка Nginx
sudo apt install -y nginx
sudo systemctl enable nginx

# Установка Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
```

### 2. Клонирование и настройка проекта

```bash
# Создание директории для приложения
sudo mkdir -p /var/www/travel-bot
sudo chown $USER:$USER /var/www/travel-bot

# Клонирование репозитория
cd /var/www/travel-bot
git clone [ваш-репозиторий] .

# Установка зависимостей
npm install

# Копирование и настройка .env
cp .env.example .env
nano .env  # Заполните все необходимые переменные
```

### 3. Настройка PostgreSQL (используем Neon)

Так как используется Neon (внешняя БД), на VPS PostgreSQL не нужен. Просто убедитесь, что `DATABASE_URL` в `.env` указывает на вашу БД в Neon.

### 4. Настройка PM2

Создайте файл `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'travel-bot',
    script: 'npm',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: 'logs/err.log',
    out_file: 'logs/out.log',
    log_file: 'logs/combined.log',
    time: true
  }]
};
```

### 5. Настройка Nginx

Создайте конфигурацию `/etc/nginx/sites-available/travel-bot`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Настройки для WebSocket (если используется)
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Активируйте конфигурацию:

```bash
sudo ln -s /etc/nginx/sites-available/travel-bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 6. Сборка и запуск

```bash
# Сборка проекта
npm run build

# Запуск миграций БД
npm run db:migrate

# Запуск через PM2
pm2 start ecosystem.config.js

# Сохранение конфигурации PM2
pm2 save
pm2 startup
```

## 🔧 Оптимизация для VPS

### 1. Настройка лимитов Node.js

В `ecosystem.config.js`:

```javascript
env: {
  NODE_ENV: 'production',
  NODE_OPTIONS: '--max-old-space-size=512'
}
```

### 2. Настройка Redis для экономии памяти

В `/etc/redis/redis.conf`:

```conf
maxmemory 100mb
maxmemory-policy allkeys-lru
save ""  # Отключить сохранение на диск если не критично
```

### 3. Логирование

Настройте ротацию логов:

```bash
sudo nano /etc/logrotate.d/travel-bot
```

```
/var/www/travel-bot/logs/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## 📊 Мониторинг

### 1. PM2 мониторинг

```bash
# Статус процессов
pm2 status

# Мониторинг в реальном времени
pm2 monit

# Логи
pm2 logs
```

### 2. Системный мониторинг

```bash
# Установка htop
sudo apt install htop

# Мониторинг ресурсов
htop
```

### 3. Настройка алертов

Используйте PM2 Plus или настройте простой скрипт:

```bash
#!/bin/bash
# check-health.sh

# Проверка статуса PM2
if ! pm2 list | grep -q "travel-bot.*online"; then
    echo "Bot is down!" | mail -s "Travel Bot Alert" your-email@example.com
    pm2 restart travel-bot
fi

# Проверка использования памяти
MEM_USAGE=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
if (( $(echo "$MEM_USAGE > 80" | bc -l) )); then
    echo "High memory usage: $MEM_USAGE%" | mail -s "Memory Alert" your-email@example.com
fi
```

## 🚨 Обработка нагрузки

### Стратегии масштабирования:

1. **Вертикальное масштабирование**
   - Увеличение ресурсов VPS (RAM, CPU)
   - Оптимизация кода и запросов

2. **Горизонтальное масштабирование**
   - Использование нескольких VPS с балансировщиком
   - Разделение бота и API на разные серверы

3. **Оптимизация кеширования**
   - Увеличение TTL для статичных данных
   - Кеширование результатов поиска
   - CDN для статики

4. **Очереди задач**
   - Bull для обработки тяжелых операций
   - Отложенная обработка несрочных задач

### Рекомендации по нагрузке:

| Пользователей | VPS конфигурация | Оптимизации |
|--------------|------------------|-------------|
| < 100 | 1 CPU, 1GB RAM | Базовая настройка |
| 100-500 | 2 CPU, 2GB RAM | Redis кеш, индексы БД |
| 500-1000 | 4 CPU, 4GB RAM | CDN, очереди, репликация БД |
| > 1000 | Кластер | Микросервисы, Kubernetes |

## 🔒 Безопасность на VPS

1. **Настройка firewall**:
```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

2. **Fail2ban для защиты от брутфорса**:
```bash
sudo apt install fail2ban
```

3. **Регулярные обновления**:
```bash
# Автоматические обновления безопасности
sudo apt install unattended-upgrades
sudo dpkg-reconfigure unattended-upgrades
```

4. **Резервное копирование**:
```bash
# Ежедневный бэкап БД
0 3 * * * pg_dump $DATABASE_URL | gzip > /backup/db-$(date +\%Y\%m\%d).sql.gz
```

## 📝 Заключение

Ваш бот отлично подойдет для VPS на Beget! При правильной настройке сможет обслуживать сотни пользователей на минимальном тарифе. Начните с небольшого VPS и масштабируйтесь по мере роста нагрузки.