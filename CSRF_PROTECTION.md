# CSRF Protection Setup Guide

## Обзор

Проект использует Double Submit Cookie pattern для защиты от CSRF (Cross-Site Request Forgery) атак. Эта защита обязательна для всех изменяющих операций (POST, PUT, DELETE, PATCH).

## Как это работает

1. **Сервер генерирует токен** - уникальный CSRF токен создается для каждой сессии
2. **Токен сохраняется в cookie** - с флагами httpOnly и secure
3. **Клиент получает токен** - через endpoint `/api/csrf-token`
4. **Токен отправляется в заголовке** - в каждом изменяющем запросе
5. **Сервер проверяет соответствие** - токен из cookie и заголовка должны совпадать

## Настройка

### На сервере

CSRF защита уже настроена в `server/middleware/security.ts`:

```typescript
// Автоматически применяется ко всем POST, PUT, DELETE, PATCH запросам
// Исключения: /api/webhook, /api/telegram
```

### На клиенте

#### 1. Использование хука useCsrf

```typescript
import { useCsrf } from '@/hooks/use-csrf';

function MyComponent() {
  const { secureFetch, csrfToken } = useCsrf();

  const handleSubmit = async (data) => {
    // secureFetch автоматически добавит CSRF токен
    const response = await secureFetch('/api/profile', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };
}
```

#### 2. Использование API клиента

```typescript
import { apiClient } from '@/lib/api-client';
import { useCsrf } from '@/hooks/use-csrf';

function App() {
  const { csrfToken } = useCsrf();
  
  // Устанавливаем токен глобально
  useEffect(() => {
    if (csrfToken) {
      apiClient.setCsrfToken(csrfToken);
    }
  }, [csrfToken]);

  // Теперь все запросы через apiClient будут защищены
  const updateProfile = async (data) => {
    await apiClient.post('/profile', data);
  };
}
```

#### 3. Прямое использование с fetch

```typescript
const { csrfToken } = useCsrf();

fetch('/api/profile', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrfToken, // Важно!
  },
  credentials: 'include', // Обязательно для cookies
  body: JSON.stringify(data),
});
```

## Исключения

CSRF защита НЕ применяется к:

1. **GET, HEAD, OPTIONS запросам** - они не должны изменять состояние
2. **/api/webhook** - для внешних webhook'ов
3. **/api/telegram** - для Telegram API callbacks
4. **Запросам с валидным JWT** - дополнительная защита не требуется

## Конфигурация

### Переменные окружения

```env
CSRF_SECRET=your_random_secret_min_32_chars
```

### Настройки cookie

```typescript
{
  cookieName: 'x-csrf-token',
  cookieOptions: {
    httpOnly: true,
    secure: true, // В production
    sameSite: 'strict',
    path: '/',
  }
}
```

## Тестирование

### Проверка защиты

```bash
# Получить CSRF токен
curl -c cookies.txt http://localhost:5000/api/csrf-token

# Попытка без токена - должна вернуть 403
curl -b cookies.txt -X POST http://localhost:5000/api/profile \
  -H "Content-Type: application/json" \
  -d '{"name":"Test"}'

# С правильным токеном - должна работать
curl -b cookies.txt -X POST http://localhost:5000/api/profile \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: <token-from-first-request>" \
  -d '{"name":"Test"}'
```

### Unit тесты

```typescript
describe('CSRF Protection', () => {
  it('should reject POST without token', async () => {
    const response = await request(app)
      .post('/api/profile')
      .send({ name: 'Test' });
    
    expect(response.status).toBe(403);
  });

  it('should accept POST with valid token', async () => {
    const tokenResponse = await request(app)
      .get('/api/csrf-token');
    
    const response = await request(app)
      .post('/api/profile')
      .set('X-CSRF-Token', tokenResponse.body.csrfToken)
      .send({ name: 'Test' });
    
    expect(response.status).toBe(200);
  });
});
```

## Troubleshooting

### "CSRF token missing or invalid"

1. Убедитесь что запрашиваете токен перед использованием
2. Проверьте что отправляете `credentials: 'include'`
3. Проверьте имя заголовка: `X-CSRF-Token` (регистр важен)
4. Токен может истечь - запросите новый

### "CSRF token mismatch"

1. Проверьте что используете токен из того же браузера/сессии
2. Убедитесь что cookies не блокируются браузером
3. В Safari могут быть проблемы с SameSite - проверьте настройки

### Проблемы в development

В режиме разработки:
- Используйте `secure: false` для cookies
- Можно временно отключить проверку для отладки
- Проверьте CORS настройки

## Best Practices

1. **Всегда используйте CSRF для изменяющих операций**
2. **Не отключайте защиту для удобства** - лучше настроить исключения
3. **Обновляйте токен при ошибках** - может истечь сессия
4. **Логируйте CSRF ошибки** - для обнаружения атак
5. **Используйте SameSite cookies** - дополнительная защита

## Дополнительная безопасность

Для критических операций рекомендуется:

1. **Повторная аутентификация** - запрос пароля
2. **Подтверждение через email/SMS** - для финансовых операций
3. **Логирование всех действий** - для аудита
4. **Rate limiting** - против brute force