# JWT Authentication Guide

## Обзор

Проект использует JWT (JSON Web Tokens) для аутентификации пользователей. Это обеспечивает:
- Stateless аутентификацию
- Масштабируемость
- Безопасность через короткоживущие access токены
- Удобство через долгоживущие refresh токены

## Архитектура

### Типы токенов

1. **Access Token**
   - Время жизни: 15 минут (настраивается)
   - Используется для доступа к API
   - Содержит минимальную информацию о пользователе
   - Не может быть отозван (кроме blacklist)

2. **Refresh Token**
   - Время жизни: 7 дней (настраивается)
   - Используется только для обновления токенов
   - Хранится в Redis для возможности отзыва
   - One-time use (инвалидируется после использования)

### Payload структура

```typescript
{
  userId: string;        // ID пользователя
  telegramId: string;    // Telegram ID
  username?: string;     // Username из Telegram
  type: 'access' | 'refresh';
  iat: number;          // Issued at
  exp: number;          // Expiration
  iss: string;          // Issuer
  aud: string;          // Audience
}
```

## API Endpoints

### 1. Аутентификация через Telegram Web App

```http
POST /api/auth/telegram
Content-Type: application/json

{
  "initData": "query_id=AAHdF6IQ...&user={...}&auth_date=..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "user": {
    "userId": "123456789",
    "telegramId": "123456789",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "hasProfile": true
  }
}
```

### 2. Обновление токенов

```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900
}
```

### 3. Выход (Logout)

```http
POST /api/auth/logout
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "message": "Successfully logged out"
}
```

### 4. Текущий пользователь

```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "userId": "123456789",
  "telegramId": "123456789",
  "username": "johndoe",
  "profile": {
    "id": 1,
    "name": "John Doe",
    "vacationType": "beach",
    "countries": ["Turkey", "Egypt"]
  }
}
```

## Использование в коде

### Frontend (React)

```typescript
// Сохранение токенов
const login = async (initData: string) => {
  const response = await fetch('/api/auth/telegram', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initData })
  });
  
  const data = await response.json();
  
  // Сохраняем токены
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
  
  // Устанавливаем таймер для обновления
  scheduleTokenRefresh(data.expiresIn);
};

// Использование токена
const fetchProfile = async () => {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('/api/profile/me', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (response.status === 401) {
    // Token expired, try to refresh
    await refreshAccessToken();
    // Retry request
  }
  
  return response.json();
};

// Обновление токена
const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });
  
  if (!response.ok) {
    // Refresh failed, redirect to login
    redirectToLogin();
    return;
  }
  
  const data = await response.json();
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);
};
```

### Axios Interceptor

```typescript
import axios from 'axios';

// Request interceptor
axios.interceptors.request.use(
  config => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor
axios.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        await refreshAccessToken();
        return axios(originalRequest);
      } catch (refreshError) {
        redirectToLogin();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

## Middleware на сервере

### Обязательная авторизация

```typescript
app.get('/api/profile/:userId',
  requireAuth,
  async (req, res) => {
    // req.user содержит декодированный токен
    const { userId } = req.user;
  }
);
```

### Опциональная авторизация

```typescript
app.get('/api/tours',
  optionalAuth,
  async (req, res) => {
    if (req.user) {
      // Пользователь авторизован
      // Можем показать персонализированные результаты
    } else {
      // Анонимный пользователь
      // Показываем общие результаты
    }
  }
);
```

### Проверка владельца

```typescript
app.put('/api/profile/:userId',
  requireAuth,
  authorizeOwner('userId'), // Проверяет что userId в params = userId в токене
  async (req, res) => {
    // Пользователь может редактировать только свой профиль
  }
);
```

## Безопасность

### 1. Хранение токенов

**Frontend:**
- Access token: В памяти или sessionStorage
- Refresh token: В httpOnly cookie (рекомендуется) или localStorage

**Backend:**
- JWT секреты: В переменных окружения
- Refresh tokens: В Redis для отзыва

### 2. Защита от атак

**XSS:**
- Не храните токены в localStorage если возможно
- Используйте httpOnly cookies для refresh токенов
- Санитизируйте весь пользовательский контент

**CSRF:**
- Используйте CSRF токены для критичных операций
- Проверяйте Referer/Origin заголовки

**Token hijacking:**
- Короткое время жизни access токенов (15 минут)
- Ротация refresh токенов при использовании
- IP/device binding (опционально)

### 3. Best Practices

1. **Всегда используйте HTTPS** в production
2. **Не логируйте токены** в production
3. **Ротируйте секреты** периодически
4. **Мониторьте подозрительную активность**
5. **Реализуйте token blacklist** для критичных случаев

## Конфигурация

### Переменные окружения

```bash
# JWT Access Token
JWT_ACCESS_SECRET=your-super-secret-access-key
JWT_ACCESS_EXPIRY=15m

# JWT Refresh Token
JWT_REFRESH_SECRET=your-super-secret-refresh-key
JWT_REFRESH_EXPIRY=7d

# JWT Configuration
JWT_ISSUER=ai-travel-agent
JWT_AUDIENCE=ai-travel-agent-api
```

### Генерация секретов

```bash
# Генерация случайного секрета
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Или используя openssl
openssl rand -hex 32
```

## Отладка

### Декодирование токена

```typescript
// На клиенте (без верификации)
const decodeToken = (token: string) => {
  const [, payload] = token.split('.');
  return JSON.parse(atob(payload));
};

// На сервере
import { decodeToken } from './services/auth';
const decoded = decodeToken(token);
```

### Проверка в jwt.io

1. Скопируйте токен
2. Вставьте на https://jwt.io
3. Добавьте секрет для верификации подписи

### Логирование

Все операции с токенами логируются:
```
[INFO] Generated tokens for user 123456789
[INFO] User 123456789 authenticated via Telegram Web App
[WARN] Blacklisted user 123456789 tried to access /api/profile
[ERROR] JWT secrets are not set in production!
```

## Миграция с сессий

Если мигрируете с session-based auth:

1. **Параллельная поддержка:**
   ```typescript
   const auth = requireAuth || requireSession;
   ```

2. **Постепенная миграция:**
   - Новые endpoints используют JWT
   - Старые поддерживают оба метода
   - Удаляйте session поддержку постепенно

3. **Конвертация сессий:**
   ```typescript
   // При логине через старый метод
   if (req.session.userId) {
     const tokens = await generateTokens({
       userId: req.session.userId,
       // ...
     });
     // Отправляем токены клиенту
   }
   ```