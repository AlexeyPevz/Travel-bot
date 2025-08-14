import { BaseCommand, CommandContext } from './base';
import { storage } from '../../storage';
import { MESSAGES, getQuickActions } from '../messages/templates';
import logger from '../../utils/logger';

/**
 * Команда /start - начало работы с ботом
 */
export class StartCommand extends BaseCommand {
  name = 'start';
  description = 'Начать работу с ботом';
  usage = '/start';

  protected async executeCommand(ctx: CommandContext): Promise<void> {
    const { bot, chatId, userId, message } = ctx;

    try {
      // Проверяем, приватный ли это чат
      const isPrivate = this.isPrivateChat(chatId);
      
      if (!isPrivate) {
        await this.sendMessage(
          bot,
          chatId,
          'Привет! Я работаю в личных сообщениях. Нажмите на кнопку ниже, чтобы начать.',
          {
            reply_markup: {
              inline_keyboard: [[
                {
                  text: 'Начать в личном чате',
                  url: `https://t.me/${(await bot.getMe()).username}?start=from_group`
                }
              ]]
            }
          }
        );
        return;
      }

      // Проверяем параметры deep link
      const startParam = message?.text?.split(' ')[1];
      let deepLinkMessage = '';
      
      if (startParam) {
        if (startParam.startsWith('group_')) {
          deepLinkMessage = '\n\n✅ Вы пришли из группового чата. После заполнения анкеты вернитесь в группу и нажмите "Я готов к поиску".';
        }
      }

      // Проверяем, есть ли у пользователя профиль
      const profile = await storage.getProfile(userId);
      
      if (profile) {
        // Возвращающийся пользователь
        await this.sendMessage(
          bot,
          chatId,
          MESSAGES.welcome.returning + deepLinkMessage,
          { reply_markup: getQuickActions('start') }
        );
      } else {
        // Новый пользователь
        await this.sendMessage(
          bot,
          chatId,
          MESSAGES.welcome.firstTime + deepLinkMessage,
          { reply_markup: getQuickActions('start') }
        );
      }

      // Логируем использование команды
      logger.info(`User ${userId} started bot, profile exists: ${!!profile}`);
      
    } catch (error) {
      await this.sendError(bot, chatId, error as Error);
    }
  }
}