# SSL Certificate Setup Guide

## Обзор

Для production окружения обязательно использование HTTPS. Это руководство покрывает настройку SSL сертификатов для различных сценариев развертывания.

## Варианты получения SSL сертификатов

### 1. Let's Encrypt (Рекомендуется)

Бесплатные сертификаты с автоматическим обновлением.

#### Установка через Certbot с Docker

```bash
# 1. Создайте директории для сертификатов
mkdir -p ./ssl/live
mkdir -p ./ssl/renewal

# 2. Получите сертификат (замените your-domain.com на ваш домен)
docker run -it --rm \
  -v $(pwd)/ssl:/etc/letsencrypt \
  -v $(pwd)/ssl/logs:/var/log/letsencrypt \
  -p 80:80 \
  certbot/certbot certonly \
  --standalone \
  --agree-tos \
  --no-eff-email \
  --email your-email@example.com \
  -d your-domain.com \
  -d www.your-domain.com
```

#### Автоматическое обновление

Создайте cron задачу или systemd timer:

```bash
# Файл: /etc/cron.d/certbot-renew
0 2 * * * root docker run --rm -v /path/to/ssl:/etc/letsencrypt certbot/certbot renew --quiet && docker-compose restart nginx
```

### 2. Cloudflare SSL

Если используете Cloudflare:

1. Включите "Full (strict)" SSL в панели Cloudflare
2. Используйте Origin Certificate:
   - Перейдите в SSL/TLS → Origin Server
   - Create Certificate
   - Сохраните сертификат и ключ

### 3. Самоподписанный сертификат (только для разработки)

```bash
# Генерация самоподписанного сертификата
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ./ssl/private.key \
  -out ./ssl/certificate.crt \
  -subj "/C=RU/ST=Moscow/L=Moscow/O=YourOrg/CN=localhost"
```

## Настройка Nginx

### 1. Обновите nginx.conf

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Редирект на HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
    
    # Для Let's Encrypt проверки
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;
    
    # Пути к сертификатам
    ssl_certificate /etc/nginx/ssl/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/live/your-domain.com/privkey.pem;
    
    # Настройки SSL
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/nginx/ssl/live/your-domain.com/chain.pem;
    
    # Проксирование к приложению
    location / {
        proxy_pass http://app:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Обновите docker-compose.yml

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - ./certbot/www:/var/www/certbot:ro
    depends_on:
      - app
    restart: unless-stopped

  # Опционально: автоматическое обновление сертификатов
  certbot:
    image: certbot/certbot
    volumes:
      - ./ssl:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
    restart: unless-stopped
```

## Настройка приложения

### 1. Обновите переменные окружения

```env
# Production URL с HTTPS
APP_URL=https://your-domain.com

# Включите secure cookies
NODE_ENV=production
SECURE_COOKIES=true

# Telegram WebApp домен
TELEGRAM_WEBAPP_DOMAIN=your-domain.com
```

### 2. Обновите настройки безопасности

В `server/middleware/security.ts`:

```typescript
// Cookies должны быть secure в production
const isProduction = process.env.NODE_ENV === 'production';

cookieOptions: {
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict',
  domain: isProduction ? '.your-domain.com' : undefined,
}
```

## Проверка SSL

### 1. SSL Labs Test

После настройки проверьте рейтинг:
https://www.ssllabs.com/ssltest/analyze.html?d=your-domain.com

Цель: рейтинг A или A+

### 2. Проверка сертификата

```bash
# Информация о сертификате
openssl s_client -connect your-domain.com:443 -servername your-domain.com < /dev/null

# Проверка срока действия
echo | openssl s_client -connect your-domain.com:443 2>/dev/null | openssl x509 -noout -dates
```

### 3. Проверка HTTPS редиректа

```bash
# Должен вернуть 301 редирект
curl -I http://your-domain.com
```

## Troubleshooting

### "Certificate verify failed"

1. Проверьте что сертификат не истек
2. Убедитесь что используется полная цепочка (fullchain.pem)
3. Проверьте права доступа к файлам сертификата

### "Mixed content" warnings

1. Убедитесь что все ресурсы загружаются через HTTPS
2. Используйте относительные URL или //domain.com вместо http://
3. Добавьте CSP заголовок: `Content-Security-Policy: upgrade-insecure-requests`

### WebSocket через HTTPS

Обновите клиентский код:

```typescript
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);
```

## Мониторинг SSL

### 1. Настройте алерты об истечении

Добавьте в мониторинг:

```yaml
# prometheus/alerts.yml
groups:
  - name: ssl
    rules:
      - alert: SSLCertificateExpiringSoon
        expr: ssl_cert_not_after - time() < 7 * 24 * 60 * 60
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "SSL certificate expiring soon"
          description: "SSL certificate for {{ $labels.domain }} expires in less than 7 days"
```

### 2. Автоматическая проверка

Скрипт для проверки сертификатов:

```bash
#!/bin/bash
# check-ssl.sh

DOMAIN="your-domain.com"
DAYS_WARNING=30

expiry_date=$(echo | openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN} 2>/dev/null | openssl x509 -noout -enddate | cut -d= -f2)
expiry_epoch=$(date -d "${expiry_date}" +%s)
current_epoch=$(date +%s)
days_left=$(( ($expiry_epoch - $current_epoch) / 86400 ))

if [ $days_left -lt $DAYS_WARNING ]; then
    echo "WARNING: SSL certificate expires in $days_left days"
    # Отправить уведомление
fi
```

## Best Practices

1. **Всегда используйте HTTPS в production**
2. **Настройте автоматическое обновление сертификатов**
3. **Используйте strong ciphers и современные протоколы**
4. **Включите HSTS для защиты от downgrade атак**
5. **Регулярно проверяйте SSL конфигурацию**
6. **Храните приватные ключи безопасно**
7. **Используйте отдельные сертификаты для разных окружений**

## Дополнительная безопасность

### HTTP Public Key Pinning (HPKP)

```nginx
add_header Public-Key-Pins 'pin-sha256="base64+primary=="; pin-sha256="base64+backup=="; max-age=5184000; includeSubDomains' always;
```

### Certificate Transparency

```nginx
add_header Expect-CT "max-age=86400, enforce" always;
```

### DNS CAA Records

Добавьте CAA записи в DNS:

```
your-domain.com. CAA 0 issue "letsencrypt.org"
your-domain.com. CAA 0 issuewild "letsencrypt.org"
```