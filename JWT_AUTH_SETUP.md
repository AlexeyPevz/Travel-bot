# JWT Authentication Setup Guide

## Обзор

Проект использует JWT (JSON Web Tokens) для аутентификации пользователей в веб-интерфейсе. Аутентификация интегрирована с Telegram WebApp для безопасной верификации пользователей.

## Настройка

### 1. Генерация секретных ключей

Сгенерируйте безопасные случайные ключи для JWT:

```bash
# Генерация JWT секрета
openssl rand -base64 32

# Генерация секрета для сессий
openssl rand -base64 32
```

### 2. Переменные окружения

Добавьте в `.env`:

```env
JWT_SECRET=ваш_сгенерированный_jwt_секрет
SESSION_SECRET=ваш_сгенерированный_session_секрет
```

### 3. Конфигурация токенов

JWT токены настроены со следующими параметрами:
- **Access Token**: 15 минут
- **Refresh Token**: 7 дней
- **Алгоритм**: HS256

## Использование

### Аутентификация через Telegram WebApp

1. Пользователь открывает WebApp через Telegram
2. Telegram передает initData с подписанными данными
3. Сервер верифицирует подпись используя токен бота
4. После успешной верификации выдается JWT токен

### API Endpoints

```typescript
// Аутентификация
POST /api/auth/telegram
Body: { initData: string }
Response: { accessToken, refreshToken, user }

// Обновление токена
POST /api/auth/refresh
Body: { refreshToken: string }
Response: { accessToken, refreshToken }

// Выход
POST /api/auth/logout
Headers: { Authorization: "Bearer <token>" }

// Проверка токена
GET /api/auth/verify
Headers: { Authorization: "Bearer <token>" }
Response: { valid: boolean, user }
```

### Защищенные маршруты

Используйте middleware для защиты маршрутов:

```typescript
import { requireAuth } from './middleware/auth';

// Требует аутентификации
app.get('/api/profile', requireAuth, (req, res) => {
  // req.user содержит данные пользователя
});

// Опциональная аутентификация
app.get('/api/tours', optionalAuth, (req, res) => {
  // req.user может быть undefined
});
```

## Безопасность

### Верификация Telegram WebApp данных

Система проверяет:
1. **HMAC подпись** - используя токен бота как секрет
2. **Срок действия** - данные действительны 5 минут
3. **Целостность** - все параметры проверяются

### Хранение токенов

**На клиенте:**
- Access token: в памяти приложения
- Refresh token: в httpOnly cookie или secure storage

**На сервере:**
- Refresh токены кешируются в Redis
- Поддерживается revoke токенов

### Защита от атак

1. **XSS**: токены не доступны через JavaScript
2. **CSRF**: используется double submit cookie pattern
3. **Replay attacks**: проверка временной метки
4. **Token theft**: короткий срок жизни access token

## Отладка

### Режим разработки

В development режиме:
- Ослаблена проверка Telegram подписи
- Включены подробные логи ошибок
- Можно использовать тестовые токены

### Проверка токенов

```bash
# Декодировать токен
echo "ваш_jwt_токен" | cut -d. -f2 | base64 -d | jq

# Проверить подпись
curl -H "Authorization: Bearer ваш_токен" http://localhost:5000/api/auth/verify
```

## Миграция существующих пользователей

Для пользователей без JWT:
1. При первом входе создается JWT сессия
2. userId из Telegram используется как уникальный идентификатор
3. Профиль автоматически связывается с JWT

## Troubleshooting

### "Invalid token" ошибки
- Проверьте JWT_SECRET в .env
- Убедитесь что токен не истек
- Проверьте формат заголовка: "Bearer <token>"

### "Data verification failed"
- Проверьте TELEGRAM_TOKEN в .env
- Убедитесь что initData не старше 5 минут
- Проверьте что домен совпадает с настройками бота

### "Token expired"
- Используйте refresh token для получения нового
- Проверьте синхронизацию времени сервера