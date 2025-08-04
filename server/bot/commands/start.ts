import { BaseCommand, CommandContext } from './base';
import { storage } from '../../storage';
import { resetUserState } from '../fsm';
import { sendIntroCards } from '../utils/onboarding';

/**
 * Команда /start - начало работы с ботом
 */
export class StartCommand extends BaseCommand {
  name = 'start';
  description = 'Начать работу с ботом';
  usage = '/start';

  protected async executeCommand(ctx: CommandContext): Promise<void> {
    const { bot, chatId, userId } = ctx;

    try {
      // Сбрасываем состояние пользователя
      resetUserState(userId);
      
      // Проверяем, есть ли у пользователя профиль
      const existingProfile = await storage.getProfile(userId);
      
      if (existingProfile) {
        // Возвращающийся пользователь
        const keyboard = {
          inline_keyboard: [
            [{ 
              text: 'Открыть приложение', 
              web_app: { 
                url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/profile` 
              } 
            }],
            [{ text: 'Редактировать анкету', callback_data: 'edit_profile' }],
            [{ text: 'Показать туры', callback_data: 'show_tours' }]
          ]
        };
        
        await this.sendMessage(
          bot,
          chatId,
          `Рады видеть вас снова, ${existingProfile.name}! Что бы вы хотели сделать?`,
          { reply_markup: keyboard }
        );
        
        // Для существующих пользователей не показываем онбординг автоматически
        // Они могут вызвать его командой /help при необходимости
      } else {
        // Новый пользователь - отправляем карточки онбординга
        await sendIntroCards(bot, chatId, userId);
      }
    } catch (error) {
      await this.sendError(bot, chatId, error as Error);
    }
  }
}