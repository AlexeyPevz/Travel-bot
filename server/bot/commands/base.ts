import TelegramBot, { Message, CallbackQuery } from 'node-telegram-bot-api';
import { db } from '../../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import logger from '../../utils/logger';
import { botCommandDuration, trackBotCommand, trackAsyncOperation } from '../../monitoring/metrics';

/**
 * Базовый интерфейс для контекста команды
 */
export interface CommandContext {
  bot: TelegramBot;
  chatId: number;
  userId: string;
  message?: Message;
  callbackQuery?: CallbackQuery;
  params?: string[];
}

/**
 * Интерфейс для обработчика команды
 */
export interface ICommand {
  name: string;
  description: string;
  usage?: string;
  aliases?: string[];
  execute(ctx: CommandContext): Promise<void>;
}

/**
 * Базовый класс для команд
 */
export abstract class BaseCommand implements ICommand {
  abstract name: string;
  abstract description: string;
  usage?: string;
  aliases?: string[];

  /**
   * Выполнить команду с отслеживанием метрик
   */
  async execute(ctx: CommandContext): Promise<void> {
    const { chatId } = ctx;
    const chatType = chatId > 0 ? 'private' : chatId < -1000000000000 ? 'supergroup' : 'group';
    
    try {
      await trackAsyncOperation(
        botCommandDuration,
        { command: this.name, status: 'pending' },
        async () => {
          await this.executeCommand(ctx);
          trackBotCommand(this.name, chatType, true);
        }
      );
    } catch (error) {
      trackBotCommand(this.name, chatType, false);
      throw error;
    }
  }

  /**
   * Абстрактный метод для реализации логики команды
   */
  protected abstract executeCommand(ctx: CommandContext): Promise<void>;

  /**
   * Получить профиль пользователя
   */
  protected async getUserProfile(userId: string) {
    const [profile] = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    
    return profile;
  }

  /**
   * Отправить сообщение с обработкой ошибок
   */
  protected async sendMessage(
    bot: TelegramBot, 
    chatId: number, 
    text: string, 
    options?: any
  ): Promise<TelegramBot.Message> {
    try {
      return await bot.sendMessage(chatId, text, options);
    } catch (error) {
      // Log detailed error
      const err: any = error;
      const description: string | undefined = err?.response?.body?.description || err?.message;
      logger.error('Error sending message:', { description, code: err?.code });

      // Fallback: sanitize and truncate message, remove markup
      try {
        const sanitized = (text || '').toString().slice(0, 3500);
        const fallbackOptions: any = { disable_web_page_preview: true };
        // Avoid reply markup on fallback to reduce risk of Bad Request
        return await bot.sendMessage(chatId, sanitized, fallbackOptions);
      } catch (fallbackError) {
        logger.error('Fallback sendMessage failed:', { message: (fallbackError as any)?.message });
        throw error;
      }
    }
  }

  /**
   * Отправить сообщение об ошибке
   */
  protected async sendError(
    bot: TelegramBot, 
    chatId: number, 
    error: string | Error
  ): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof Error) {
      logger.error(`Command ${this.name} error: ${errorMessage}`, { stack: error.stack });
    } else {
      logger.error(`Command ${this.name} error: ${errorMessage}`);
    }
    
    await this.sendMessage(
      bot, 
      chatId, 
      '❌ Произошла ошибка при выполнении команды. Пожалуйста, попробуйте позже.'
    );
  }

  /**
   * Проверить, является ли чат групповым
   */
  protected isGroupChat(chatId: number): boolean {
    return chatId < 0;
  }

  /**
   * Проверить, является ли чат приватным
   */
  protected isPrivateChat(chatId: number): boolean {
    return chatId > 0;
  }

  /**
   * Форматировать число с разделителями тысяч
   */
  protected formatNumber(num: number): string {
    return num.toLocaleString('ru-RU');
  }

  /**
   * Форматировать дату
   */
  protected formatDate(date: Date): string {
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}