import TelegramBot from 'node-telegram-bot-api';
import { Server } from 'http';
import { handleCommand, handleMessage, handleCallback } from './handlers';
import { addReferral } from '../services/referral';
import { storage } from '../storage';
import { StartCommand } from './commands/start';

// Глобальный экземпляр бота
let bot: TelegramBot | null = null;
let isHandlingCommand = false;

function withTimeout<T>(promise: Promise<T>, ms = 5000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return (async () => {
    try {
      const result = await promise;
      return result as T;
    } finally {
      clearTimeout(timeout);
    }
  })();
}

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
  if (process.env.DISABLE_BOT === 'true') {
    console.log('Bot startup skipped due to DISABLE_BOT=true');
    // @ts-expect-error returning dummy
    return null;
  }

  const token = process.env.TELEGRAM_TOKEN;
  
  if (!token) {
    console.error('TELEGRAM_TOKEN is not set in environment variables');
    throw new Error('TELEGRAM_TOKEN is required');
  }

  try {
    // Останавливаем и очищаем предыдущий экземпляр бота если он существует
    if (bot) {
      try {
        await bot.stopPolling().catch(() => undefined);
        await new Promise(resolve => setTimeout(resolve, 500));
        bot = null;
      } catch (e) {
        console.error('Ошибка при остановке предыдущего экземпляра бота:', e);
      }
    }

    // Удаляем webhook и отбрасываем ожидающие обновления (с таймаутом)
    try {
      const del = await withTimeout(fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`), 4000);
      await del?.json?.().catch(() => undefined);
      await withTimeout(fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=-1`), 4000).catch(() => undefined);
    } catch (e) {
      console.error('Ошибка при очистке webhook (ignored):', e);
    }

    // Создаем новый экземпляр бота без polling
    const options: TelegramBot.ConstructorOptions = {
      polling: false
    };

    bot = new TelegramBot(token, options);
    console.log('Telegram bot started');
    
    // Register bot for graceful shutdown
    const { gracefulShutdown } = await import('../utils/shutdown');
    gracefulShutdown.setBot(bot);
    
    // Регистрируем обработчики команд и сообщений
    const commandHandlers = {
      'start': async (msg: TelegramBot.Message, match?: RegExpExecArray | null) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (!userId) return;
        const paramStr = match?.[1];
        if (paramStr && paramStr.startsWith('ref_')) {
          const referrerId = paramStr.substring(4);
          const referrer = await storage.getProfile(referrerId);
          if (referrer) {
            const userProfile = await storage.getProfile(userId);
            if (!userProfile) {
              await addReferral(referrerId, userId);
              await bot!.sendMessage(
                chatId,
                `Добро пожаловать! Вы перешли по реферальной ссылке от ${referrer.name}. Вы получите бонус после заполнения анкеты.`
              );
            }
          }
        }
        await handleCommand(bot!, chatId, userId, '/start', msg);
      },
      'myrequests': async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId) {
          await handleCommand(bot!, chatId, userId, '/myrequests', msg);
        }
      },
      'referral': async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId) {
          await handleCommand(bot!, chatId, userId, '/referral', msg);
        }
      },
      'help': async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId) {
          await handleCommand(bot!, chatId, userId, '/help', msg);
        }
      },
      'join': async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId && msg.chat.type !== 'private') {
          await handleCommand(bot!, chatId, userId, '/join', msg);
        }
      },
      'groupsetup': async (msg: TelegramBot.Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId && msg.chat.type !== 'private') {
          await handleCommand(bot!, chatId, userId, '/groupsetup', msg);
        }
      }
    };

    bot.onText(/\/start(?:\s+(.+))?/, commandHandlers.start);
    bot.onText(/\/myrequests/, commandHandlers.myrequests);
    bot.onText(/\/referral/, commandHandlers.referral);
    bot.onText(/\/help/, commandHandlers.help);
    bot.onText(/\/join/, commandHandlers.join);
    bot.onText(/\/groupsetup/, commandHandlers.groupsetup);

    bot.on('message', async (msg) => {
      if (msg.text && !msg.text.startsWith('/')) {
        const chatId = msg.chat.id;
        const userId = msg.from?.id.toString();
        if (userId) {
          await handleMessage(bot!, chatId, userId, msg.text, msg);
        }
      }
    });

    bot.on('callback_query', async (callbackQuery) => {
      await handleCallback(bot!, callbackQuery);
    });
    
    const useWebhook = process.env.TELEGRAM_USE_WEBHOOK === 'true';
    const appUrl = process.env.APP_URL;

    if (useWebhook && appUrl) {
      const webhookUrl = `${appUrl.replace(/\/$/, '')}/api/telegram/webhook`;
      try {
        await withTimeout(bot.setWebHook(webhookUrl) as any, 5000);
        console.log('Telegram webhook set to:', webhookUrl);
      } catch (e) {
        console.error('Failed to set webhook (ignored):', e);
      }
    } else {
      try {
        await withTimeout(bot.startPolling() as any, 5000);
      } catch (e) {
        console.error('Failed to start polling (ignored):', e);
      }
    }

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
