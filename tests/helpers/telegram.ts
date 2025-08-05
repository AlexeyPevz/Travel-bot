import crypto from 'crypto';

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

/**
 * Генерирует валидные данные Telegram WebApp для тестов
 */
export function generateTelegramAuthData(user: TelegramUser): string {
  const botToken = process.env.TELEGRAM_TOKEN || 'test_bot_token';
  const authDate = Math.floor(Date.now() / 1000);
  
  // Создаем объект данных
  const data = {
    auth_date: authDate,
    user: JSON.stringify(user),
  };
  
  // Сортируем ключи и создаем строку для подписи
  const dataCheckString = Object.keys(data)
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join('\n');
  
  // Создаем секретный ключ
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  
  // Создаем hash
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  // Формируем итоговую строку initData
  const params = new URLSearchParams();
  params.append('user', JSON.stringify(user));
  params.append('auth_date', authDate.toString());
  params.append('hash', hash);
  
  return params.toString();
}

/**
 * Генерирует случайного пользователя для тестов
 */
export function generateRandomUser(): TelegramUser {
  const id = Math.floor(Math.random() * 1000000) + 1;
  const firstNames = ['Ivan', 'Maria', 'Alexey', 'Elena', 'Dmitry', 'Olga'];
  const lastNames = ['Ivanov', 'Petrova', 'Sidorov', 'Smirnova', 'Popov'];
  
  return {
    id,
    first_name: firstNames[Math.floor(Math.random() * firstNames.length)],
    last_name: lastNames[Math.floor(Math.random() * lastNames.length)],
    username: `test_user_${id}`,
    language_code: 'ru',
  };
}

/**
 * Генерирует данные для группового чата
 */
export function generateGroupChat() {
  const id = -Math.floor(Math.random() * 1000000) - 1000000; // Отрицательные ID для групп
  
  return {
    id,
    title: `Test Group ${Math.abs(id)}`,
    type: 'group',
  };
}

/**
 * Создает Telegram callback query для тестов
 */
export function generateCallbackQuery(userId: number, data: string) {
  return {
    id: Math.random().toString(36).substring(7),
    from: {
      id: userId,
      is_bot: false,
      first_name: 'Test',
      username: `test_${userId}`,
    },
    data,
    chat_instance: Math.random().toString(36).substring(7),
  };
}

/**
 * Создает Telegram message для тестов
 */
export function generateMessage(
  userId: number,
  text: string,
  chatId?: number
) {
  const messageId = Math.floor(Math.random() * 100000) + 1;
  
  return {
    message_id: messageId,
    from: {
      id: userId,
      is_bot: false,
      first_name: 'Test',
      username: `test_${userId}`,
    },
    chat: {
      id: chatId || userId,
      type: chatId ? 'group' : 'private',
      ...(chatId && { title: `Test Group ${chatId}` }),
    },
    date: Math.floor(Date.now() / 1000),
    text,
  };
}

/**
 * Мок для Telegram Bot API
 */
export class TelegramBotMock {
  private sentMessages: any[] = [];
  private callbacks: Map<string, Function> = new Map();
  
  sendMessage(chatId: number | string, text: string, options?: any) {
    const message = {
      chatId,
      text,
      options,
      timestamp: Date.now(),
    };
    this.sentMessages.push(message);
    return Promise.resolve({ message_id: Math.random() });
  }
  
  editMessageReplyMarkup(options: any) {
    return Promise.resolve({ ok: true });
  }
  
  answerCallbackQuery(callbackQueryId: string, options?: any) {
    return Promise.resolve({ ok: true });
  }
  
  on(event: string, callback: Function) {
    this.callbacks.set(event, callback);
  }
  
  emit(event: string, data: any) {
    const callback = this.callbacks.get(event);
    if (callback) {
      callback(data);
    }
  }
  
  getSentMessages() {
    return this.sentMessages;
  }
  
  clearSentMessages() {
    this.sentMessages = [];
  }
}