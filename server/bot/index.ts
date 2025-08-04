import TelegramBot from 'node-telegram-bot-api';
import { Server } from 'http';
import { handleCommand, handleMessage, handleCallback } from './handlers';
import { addReferral } from '../services/referral';
import { storage } from '../storage';
import { StartCommand } from './commands/start';

// Глобальный экземпляр бота
let bot: TelegramBot | null = null;
let isHandlingCommand = false;

/**
 * Создает и запускает бот Telegram
 * 
 * Мы полностью отказываемся от использования polling, так как оно приводит к конфликтам
 * и используем прямые API вызовы для обработки команд, что делает приложение более стабильным
 * 
 * @param server HTTP сервер
 * @returns Экземпляр бота
 */
export async function startBot(server: Server): Promise<TelegramBot> {
  const token = process.env.TELEGRAM_TOKEN;
  
  if (!token) {
    console.error('TELEGRAM_TOKEN is not set in environment variables');
    throw new Error('TELEGRAM_TOKEN is required');
  }

  try {
    // Останавливаем и очищаем предыдущий экземпляр бота если он существует
    if (bot) {
      try {
        // Останавливаем polling, если он был активен
        await bot.stopPolling().catch(e => console.log('Polling was not active'));
        console.log('Остановлен предыдущий экземпляр бота');
        await new Promise(resolve => setTimeout(resolve, 1000));
        bot = null;
      } catch (e) {
        console.error('Ошибка при остановке предыдущего экземпляра бота:', e);
      }
    }

    // Удаляем webhook и отбрасываем ожидающие обновления
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
      const result = await response.json();
      console.log('Очистка webhook статус:', result.ok);
      
      // Очищаем очередь обновлений
      await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-1`);
    } catch (e) {
      console.error('Ошибка при очистке webhook:', e);
    }

    // Создаем новый экземпляр бота без polling
    const options: TelegramBot.ConstructorOptions = {
      polling: false  // Не используем polling, чтобы избежать конфликтов
    };

    bot = new TelegramBot(token, options);
    console.log('Telegram bot started');
    
    // Register bot for graceful shutdown
    const { gracefulShutdown } = await import('../utils/shutdown');
    gracefulShutdown.setBot(bot);
    
    // Создаем ручной API endpoint для обработки Telegram команд
    // POST /api/telegram/command/:command
    // Например: POST /api/telegram/command/help
    
    return bot;

    // Объединяем в один подход для всех команд
    const commandHandlers = {
      'start': async (msg: TelegramBot.Message, match?: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (!userId) return;
        
        const paramStr = match?.[1];
        
        if (paramStr && paramStr.startsWith('ref_')) {
          // Handle referral deep link
          const referrerId = paramStr.substring(4);
          
          // Check if referrer exists
          const referrer = await storage.getProfile(referrerId);
          
          if (referrer) {
            // Check if this is a new user
            const userProfile = await storage.getProfile(userId);
            
            if (!userProfile) {
              // New user, register referral
              await addReferral(referrerId, userId);
              
              await bot.sendMessage(
                chatId,
                `Добро пожаловать! Вы перешли по реферальной ссылке от ${referrer.name}. Вы получите бонус после заполнения анкеты.`
              );
            }
          }
        }
        
        // Continue with regular start command
        await handleCommand(bot, chatId, userId, '/start', msg);
      },
      'myrequests': async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId) {
          await handleCommand(bot, chatId, userId, '/myrequests', msg);
        }
      },
      'referral': async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId) {
          await handleCommand(bot, chatId, userId, '/referral', msg);
        }
      },
      'help': async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId) {
          await handleCommand(bot, chatId, userId, '/help', msg);
        }
      },
      'join': async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId && msg.chat.type !== 'private') {
          await handleCommand(bot, chatId, userId, '/join', msg);
        }
      },
      'groupsetup': async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId && msg.chat.type !== 'private') {
          await handleCommand(bot, chatId, userId, '/groupsetup', msg);
        }
      }
    };

    // Регистрируем обработчики команд
    bot.onText(/\/start(?:\s+(.+))?/, commandHandlers.start);
    bot.onText(/\/myrequests/, commandHandlers.myrequests);
    bot.onText(/\/referral/, commandHandlers.referral);
    bot.onText(/\/help/, commandHandlers.help);
    bot.onText(/\/join/, commandHandlers.join);
    bot.onText(/\/groupsetup/, commandHandlers.groupsetup);

    // Обработчик обычных сообщений
    bot.on('message', async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        
        if (userId) {
          await handleMessage(bot, chatId, userId, msg.text, msg);
        }
      }
    });

    // Обработчик callback_query (инлайн кнопки)
    bot.on('callback_query', async (callbackQuery) => {
      await handleCallback(bot, callbackQuery);
    });
    
    // Запускаем поллинг только после регистрации всех обработчиков
    await bot.startPolling();

    return bot;
  } catch (error) {
    console.error('Error starting Telegram bot:', error);
    throw error;
  }
}

export function getBot(): TelegramBot {
  if (!bot) {
    throw new Error('Bot has not been initialized');
  }
  return bot;
}
