import { BaseCommand, CommandContext } from './base';
import { sendIntroCards } from '../utils/onboarding';
import logger from '../../utils/logger';

/**
 * Команда /help - показать справку и функции бота
 */
export class HelpCommand extends BaseCommand {
  name = 'help';
  description = 'Показать справку и список команд';
  usage = '/help';

  protected async executeCommand(ctx: CommandContext): Promise<void> {
    const { bot, chatId, userId } = ctx;

    try {
      // Проверяем существование чата перед отправкой
      try {
        await bot.getChat(chatId);
      } catch (chatError) {
        logger.warn(`Чат ${chatId} не найден. Возможно, пользователь заблокировал бота или чат был удален.`);
        return; // Прекращаем обработку, если чат не существует
      }
      
      // Сначала отправляем список доступных команд
      const commandsList = 
        '📋 *Список доступных команд:*\n\n' +
        '/start - Начать работу с ботом\n' +
        '/help - Показать эту помощь и карточки функций\n' +
        '/myrequests - Просмотреть ваши сохраненные запросы\n' +
        '/referral - Получить реферальную ссылку\n\n' +
        '💡 *Также вы можете:*\n' +
        '• Отправить текстовое описание желаемого тура\n' +
        '• Использовать inline-кнопки для навигации\n' +
        '• Открыть веб-приложение для расширенных функций';
      
      await this.sendMessage(
        bot,
        chatId,
        commandsList,
        { parse_mode: 'Markdown' }
      );
      
      // Затем отправляем карточки онбординга с флагом force=true
      await sendIntroCards(bot, chatId, userId, true);
      
      logger.info(`Успешно отправлены карточки помощи для пользователя ${userId} в чат ${chatId}`);
    } catch (error) {
      logger.error('Error handling help command:', error);
      
      try {
        await this.sendMessage(
          bot,
          chatId,
          'Произошла ошибка при отображении помощи. Пожалуйста, попробуйте еще раз позже.'
        );
      } catch (msgError) {
        logger.error('Не удалось отправить сообщение об ошибке:', msgError);
      }
    }
  }
}