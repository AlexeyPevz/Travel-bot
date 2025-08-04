# Bot Refactoring Guide

## Обзор

Проведен рефакторинг структуры Telegram бота для улучшения модульности, тестируемости и поддерживаемости кода. Основной файл `handlers.ts` (1200+ строк) был разбит на отдельные модули.

## Новая структура

```
server/bot/
├── index.ts              # Главный файл инициализации бота
├── handlers.ts           # Основные обработчики (рефакторен)
├── commands/            # Модули команд
│   ├── base.ts         # Базовый класс и интерфейсы
│   ├── index.ts        # Регистр команд и экспорты
│   ├── start.ts        # Команда /start
│   ├── help.ts         # Команда /help
│   ├── myrequests.ts   # Команда /myrequests
│   ├── referral.ts     # Команда /referral
│   ├── join.ts         # Команда /join (для групп)
│   ├── groupsetup.ts   # Команда /groupsetup
│   └── text.ts         # Обработчик текстовых сообщений
├── callbacks/           # Обработчики callback queries
├── fsm/                # Конечный автомат для диалогов
└── utils/              # Утилиты

```

## Архитектура команд

### Базовый интерфейс

```typescript
export interface ICommand {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  execute(ctx: CommandContext): Promise<void>;
}

export interface CommandContext {
  bot: TelegramBot;
  chatId: number;
  userId: string;
  message?: Message;
  callbackQuery?: CallbackQuery;
  params?: string[];
}
```

### Базовый класс

`BaseCommand` предоставляет общую функциональность:
- Получение профиля пользователя
- Отправка сообщений с обработкой ошибок
- Форматирование чисел и дат
- Проверка типа чата (личный/групповой)

### Пример команды

```typescript
export class StartCommand extends BaseCommand {
  name = 'start';
  description = 'Начать работу с ботом';
  usage = '/start';

  async execute(ctx: CommandContext): Promise<void> {
    const { bot, chatId, userId } = ctx;
    
    try {
      // Логика команды
      const profile = await this.getUserProfile(userId);
      
      if (profile) {
        await this.sendMessage(bot, chatId, 'С возвращением!');
      } else {
        await sendIntroCards(bot, chatId, userId);
      }
    } catch (error) {
      await this.sendError(bot, chatId, error as Error);
    }
  }
}
```

## Регистр команд

`CommandRegistry` управляет всеми командами:

```typescript
const registry = new CommandRegistry();

// Автоматическая регистрация всех команд
registry.registerCommands();

// Получение команды
const command = registry.getCommand('/start');

// Проверка, является ли текст командой
if (registry.isCommand(text)) {
  // Обработка команды
}
```

## Обновленный handlers.ts

Теперь `handlers.ts` содержит только:
- `handleCommand` - маршрутизация к нужной команде
- `handleMessage` - обработка текстовых сообщений
- `handleCallback` - обработка inline кнопок
- Минимальная бизнес-логика

```typescript
export async function handleCommand(
  bot: TelegramBot, 
  chatId: number, 
  userId: string, 
  commandText: string,
  message?: TelegramBot.Message
): Promise<void> {
  const command = commandRegistry.getCommand(commandText);
  
  if (command) {
    const context: CommandContext = {
      bot, chatId, userId, message,
      params: commandRegistry.extractParams(commandText)
    };
    
    await command.execute(context);
  } else {
    await bot.sendMessage(chatId, 'Неизвестная команда');
  }
}
```

## Преимущества рефакторинга

### 1. Модульность
- Каждая команда в отдельном файле
- Легко добавлять новые команды
- Четкое разделение ответственности

### 2. Тестируемость
- Команды можно тестировать изолированно
- Легко мокать зависимости
- Предсказуемое поведение

### 3. Поддерживаемость
- Код легче читать и понимать
- Изменения локализованы
- Меньше конфликтов при командной разработке

### 4. Масштабируемость
- Легко добавлять middleware
- Поддержка алиасов команд
- Расширяемая архитектура

## Добавление новой команды

1. Создайте файл в `commands/`:
```typescript
// commands/weather.ts
export class WeatherCommand extends BaseCommand {
  name = 'weather';
  description = 'Узнать погоду на курорте';
  aliases = ['погода'];
  
  async execute(ctx: CommandContext): Promise<void> {
    // Реализация
  }
}
```

2. Добавьте в регистр:
```typescript
// commands/index.ts
import { WeatherCommand } from './weather';

private registerCommands(): void {
  const commands: ICommand[] = [
    // ...
    new WeatherCommand(),
  ];
}
```

3. Экспортируйте:
```typescript
export * from './weather';
```

## Миграция существующего кода

### Было:
```typescript
// В handlers.ts
async function handleSomeCommand(bot, chatId, userId) {
  // 100+ строк кода
}
```

### Стало:
```typescript
// commands/some.ts
export class SomeCommand extends BaseCommand {
  name = 'some';
  
  async execute(ctx: CommandContext): Promise<void> {
    // Та же логика, но структурированная
  }
}
```

## TODO

1. **FSM рефакторинг** - вынести логику конечного автомата в отдельные модули
2. **Callback handlers** - создать аналогичную структуру для обработчиков кнопок
3. **Middleware система** - добавить поддержку middleware (логирование, авторизация)
4. **Интернационализация** - поддержка многоязычности
5. **Тесты** - покрыть команды unit-тестами

## Best Practices

1. **Одна команда - один файл**
2. **Используйте базовый класс** для общей функциональности
3. **Обрабатывайте ошибки** в каждой команде
4. **Логируйте важные действия**
5. **Документируйте команды** (description, usage)
6. **Валидируйте входные данные**
7. **Используйте TypeScript** строго