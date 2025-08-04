# Validation Guide

## Обзор

Проект использует [Zod](https://zod.dev/) для валидации входных данных. Это обеспечивает:
- Типобезопасность во время выполнения
- Автоматическую генерацию TypeScript типов
- Понятные сообщения об ошибках
- Защиту от SQL инъекций и XSS атак

## Архитектура

### Схемы валидации

Все схемы находятся в `server/validators/schemas.ts`:
- Базовые схемы (userId, date, country, budget)
- Схемы для каждой сущности (profile, tour, group)
- Утилиты для валидации

### Middleware

Валидация происходит через middleware в `server/middleware/validation.ts`:
- `validateBody` - валидация тела запроса
- `validateQuery` - валидация query параметров
- `validateParams` - валидация параметров пути
- `validateAll` - комбинированная валидация

## Использование

### Простая валидация тела запроса

```typescript
app.post('/api/profile', 
  validateBody(createProfileSchema),
  async (req, res) => {
    // req.body уже провалидирован и типизирован
    const { userId, name, budget } = req.body;
  }
);
```

### Валидация query параметров

```typescript
app.get('/api/tours',
  validateQuery(tourSearchSchema),
  async (req, res) => {
    // Query параметры автоматически преобразованы в правильные типы
    const { page, limit, countries } = req.query;
    // page: number, limit: number, countries: string[]
  }
);
```

### Валидация параметров пути

```typescript
app.get('/api/profile/:userId',
  validateParams(z.object({ 
    userId: userIdSchema 
  })),
  async (req, res) => {
    const { userId } = req.params; // гарантированно числовая строка
  }
);
```

### Комбинированная валидация

```typescript
app.put('/api/tours/:tourId/book',
  validateAll({
    params: z.object({ tourId: z.string() }),
    body: bookingSchema,
    query: z.object({ notify: z.boolean() })
  }),
  async (req, res) => {
    // Все части запроса провалидированы
  }
);
```

### Создание безопасного обработчика

```typescript
const updateProfile = createValidatedHandler(
  {
    params: z.object({ userId: userIdSchema }),
    body: updateProfileSchema
  },
  async (req, res) => {
    // Автоматическая валидация и обработка ошибок
    const { userId } = req.params;
    const updates = req.body;
    
    // Бизнес-логика
    const profile = await updateUserProfile(userId, updates);
    res.json(profile);
  }
);

app.put('/api/profile/:userId', updateProfile);
```

## Схемы валидации

### Базовые типы

```typescript
// ID пользователя (числовая строка)
userIdSchema: z.string().regex(/^\d+$/)

// Дата (ISO строка или Date объект)
dateSchema: z.string().datetime().or(z.date())

// Страна (2-50 символов)
countrySchema: z.string().min(2).max(50)

// Бюджет (положительное число до 10M)
budgetSchema: z.number().int().positive().max(10000000)

// Приоритет (0-10)
prioritySchema: z.number().min(0).max(10)
```

### Примеры схем

#### Профиль пользователя

```typescript
const profileSchema = z.object({
  userId: userIdSchema,
  name: z.string().min(1).max(100).optional(),
  vacationType: z.enum(['beach', 'active', 'cultural']).optional(),
  countries: z.array(countrySchema).max(10).optional(),
  budget: budgetSchema.optional(),
  priorities: z.record(z.string(), prioritySchema).optional()
});
```

#### Поиск туров

```typescript
const tourSearchSchema = z.object({
  countries: z.array(countrySchema).min(1).max(5).optional(),
  startDate: dateSchema.optional(),
  budget: budgetSchema.optional(),
  starRating: z.number().int().min(1).max(5).optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0)
});
```

## Обработка ошибок

### Формат ошибок валидации

```json
{
  "error": "Validation Error",
  "details": {
    "message": "Validation failed: name must be at least 2 characters; age must be positive",
    "errors": [
      {
        "path": "name",
        "message": "String must contain at least 2 character(s)",
        "code": "too_small"
      },
      {
        "path": "age",
        "message": "Number must be greater than 0",
        "code": "too_small"
      }
    ]
  }
}
```

### Кастомизация ошибок

```typescript
const schema = z.object({
  email: z.string().email({
    message: "Пожалуйста, введите корректный email"
  }),
  age: z.number().min(18, {
    message: "Вы должны быть старше 18 лет"
  })
});
```

## Преобразование данных

### Автоматическое преобразование query параметров

Query параметры автоматически преобразуются:
- `"123"` → `123` (число)
- `"true"` → `true` (булево)
- `"a,b,c"` → `["a", "b", "c"]` (массив)

```typescript
// GET /api/tours?page=2&active=true&tags=beach,luxury
validateQuery(z.object({
  page: z.number(),      // 2
  active: z.boolean(),   // true
  tags: z.array(z.string()) // ["beach", "luxury"]
}))
```

### Трансформация дат

```typescript
const dateSchema = z.string().datetime().transform(val => new Date(val));

// "2024-01-05T10:00:00Z" → Date объект
```

### Нормализация данных

```typescript
const emailSchema = z.string()
  .email()
  .transform(email => email.toLowerCase().trim());

// " USER@EXAMPLE.COM " → "user@example.com"
```

## Best Practices

### 1. Переиспользуйте базовые схемы

```typescript
// ❌ Плохо
const schema1 = z.object({
  userId: z.string().regex(/^\d+$/)
});

const schema2 = z.object({
  userId: z.string().regex(/^\d+$/)
});

// ✅ Хорошо
const schema1 = z.object({
  userId: userIdSchema
});

const schema2 = z.object({
  userId: userIdSchema
});
```

### 2. Используйте строгие типы

```typescript
// ❌ Плохо
type: z.string()

// ✅ Хорошо
type: z.enum(['beach', 'active', 'cultural'])
```

### 3. Добавляйте ограничения

```typescript
// ❌ Плохо
name: z.string()

// ✅ Хорошо
name: z.string().min(1).max(100)
```

### 4. Используйте рефайны для сложной логики

```typescript
const dateRangeSchema = z.object({
  start: dateSchema,
  end: dateSchema
}).refine(data => data.start < data.end, {
  message: "Дата начала должна быть раньше даты окончания"
});
```

### 5. Документируйте схемы

```typescript
/**
 * Схема для бронирования тура
 * @param contactPhone - телефон в международном формате
 * @param passengers - минимум 1, максимум 10 пассажиров
 */
const bookingSchema = z.object({
  contactPhone: z.string()
    .regex(/^\+?\d{10,15}$/)
    .describe("Телефон в формате +79991234567"),
  passengers: z.array(passengerSchema)
    .min(1)
    .max(10)
    .describe("Список пассажиров")
});
```

## Тестирование

### Unit тесты схем

```typescript
describe('Profile Schema', () => {
  it('should validate correct profile', () => {
    const data = {
      userId: '123',
      name: 'John Doe',
      budget: 100000
    };
    
    expect(() => profileSchema.parse(data)).not.toThrow();
  });
  
  it('should reject invalid userId', () => {
    const data = {
      userId: 'abc', // не числовая строка
      name: 'John Doe'
    };
    
    expect(() => profileSchema.parse(data)).toThrow();
  });
});
```

### Integration тесты

```typescript
it('should return 400 for invalid request body', async () => {
  const response = await request(app)
    .post('/api/profile')
    .send({
      userId: 'invalid',
      budget: -1000
    });
    
  expect(response.status).toBe(400);
  expect(response.body.error).toBe('Validation Error');
  expect(response.body.details.errors).toHaveLength(2);
});
```

## Производительность

### Кеширование схем

Схемы компилируются один раз при запуске:
```typescript
// Схема создается один раз
const profileSchema = z.object({...});

// Используется многократно
validateBody(profileSchema)
```

### Async валидация

Для сложных схем используйте async версию:
```typescript
const schema = z.object({
  email: z.string().email().refine(
    async (email) => await checkEmailUnique(email),
    { message: "Email уже используется" }
  )
});

// Используйте parseAsync вместо parse
const validated = await schema.parseAsync(data);
```

## Миграция

### Из старой валидации

```typescript
// Старый код
if (!req.body.userId || !req.body.name) {
  return res.status(400).json({ error: 'Missing required fields' });
}

// Новый код
validateBody(z.object({
  userId: z.string().min(1),
  name: z.string().min(1)
}))
```

### Постепенная миграция

1. Добавьте схему рядом со старой валидацией
2. Запустите в параллель для сравнения
3. Удалите старую валидацию после тестирования