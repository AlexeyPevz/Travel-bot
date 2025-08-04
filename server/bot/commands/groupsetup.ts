import { BaseCommand, CommandContext } from './base';
import { storage } from '../../storage';
import { createOrUpdateGroupProfile } from '../../services/groups';
import logger from '../../utils/logger';

/**
 * Команда /groupsetup - настройка группового поиска
 */
export class GroupSetupCommand extends BaseCommand {
  name = 'groupsetup';
  description = 'Настроить групповой поиск тура';
  usage = '/groupsetup';

  protected async executeCommand(ctx: CommandContext): Promise<void> {
    const { bot, chatId, userId, message } = ctx;

    try {
      // Проверяем, что команда вызвана в группе
      if (!this.isGroupChat(chatId)) {
        await this.sendMessage(
          bot,
          chatId,
          'Эта команда доступна только в групповых чатах. Добавьте бота в группу для совместного поиска туров.'
        );
        return;
      }
      
      // Проверяем права администратора
      const chatMember = await bot.getChatMember(chatId, userId);
      const isAdmin = ['administrator', 'creator'].includes(chatMember.status);
      
      if (!isAdmin) {
        await this.sendMessage(
          bot,
          chatId,
          'Только администраторы группы могут настраивать групповой поиск.'
        );
        return;
      }
      
      // Получаем информацию о чате
      const chat = await bot.getChat(chatId);
      const chatTitle = chat.title || 'Группа';
      
      // Создаем или обновляем групповой профиль
      const groupId = await createOrUpdateGroupProfile(
        chatId.toString(), 
        chatTitle, 
        [userId] // Добавляем создателя как первого участника
      );
      
      logger.info(`Group profile created/updated: ${groupId} for chat ${chatId}`);
      
      await this.sendMessage(
        bot,
        chatId,
        `✅ *Групповой поиск настроен!*\n\n` +
        `Теперь участники группы могут:\n` +
        `• Использовать /join для присоединения к поиску\n` +
        `• Искать туры вместе\n` +
        `• Голосовать за понравившиеся варианты\n\n` +
        `Вы автоматически добавлены как первый участник.`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '👥 Пригласить участников', callback_data: 'invite_group_members' }],
              [{ text: '🔍 Начать поиск туров', callback_data: 'group_search_tours' }]
            ]
          }
        }
      );
      
      // Отправляем инструкцию для участников
      await this.sendMessage(
        bot,
        chatId,
        `📢 *Внимание всем участникам группы!*\n\n` +
        `Чтобы присоединиться к групповому поиску туров:\n` +
        `1. Напишите боту в личные сообщения и заполните анкету\n` +
        `2. Вернитесь в эту группу и используйте команду /join\n\n` +
        `После этого мы сможем искать туры с учетом предпочтений всех участников!`,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { 
                text: '💬 Написать боту', 
                url: `https://t.me/${(await bot.getMe()).username}?start=from_group_${chatId}` 
              }
            ]]
          }
        }
      );
    } catch (error) {
      await this.sendError(bot, chatId, error as Error);
    }
  }
}