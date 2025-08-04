import { BaseCommand, CommandContext } from './base';
import { storage } from '../../storage';

/**
 * Команда /myrequests - показать активные запросы пользователя
 */
export class MyRequestsCommand extends BaseCommand {
  name = 'myrequests';
  description = 'Просмотреть ваши сохраненные запросы';
  usage = '/myrequests';

  protected async executeCommand(ctx: CommandContext): Promise<void> {
    const { bot, chatId, userId } = ctx;

    try {
      // Получаем профиль пользователя
      const profile = await storage.getProfile(userId);
      
      if (!profile) {
        await this.sendMessage(
          bot,
          chatId,
          'Для использования этой команды сначала необходимо заполнить анкету. Используйте /start.'
        );
        return;
      }
      
      // Получаем активные watchlists
      const watchlists = await storage.getWatchlists(userId);
      
      if (watchlists.length === 0) {
        await this.sendMessage(
          bot,
          chatId,
          'У вас пока нет активных запросов. Вы можете создать новый запрос в приложении.',
          {
            reply_markup: {
              inline_keyboard: [[
                { 
                  text: 'Открыть приложение', 
                  web_app: { 
                    url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/watchlist` 
                  } 
                }
              ]]
            }
          }
        );
        return;
      }
      
      // Форматируем watchlists
      let message = '📋 *Ваши активные запросы:*\n\n';
      
      watchlists.forEach((watchlist, index) => {
        message += `*${index + 1}. ${watchlist.destination}*\n`;
        message += `   💰 Бюджет: ${watchlist.budget ? `${this.formatNumber(watchlist.budget)} ₽` : 'не указан'}\n`;
        message += `   📅 Длительность: ${watchlist.tripDuration || 'не указана'} дней\n`;
        message += `   ✅ Статус: ${watchlist.active ? 'активный' : 'приостановлен'}\n`;
        
        if (watchlist.deadline) {
          const daysLeft = Math.floor((new Date(watchlist.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          message += `   ⏰ Срок ожидания: ${daysLeft > 0 ? `осталось ${daysLeft} дней` : 'истек'}\n`;
        }
        
        message += '\n';
      });
      
      await this.sendMessage(bot, chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { 
              text: '⚙️ Управление запросами', 
              web_app: { 
                url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/watchlist` 
              } 
            }
          ]]
        }
      });
    } catch (error) {
      await this.sendError(bot, chatId, error as Error);
    }
  }
}