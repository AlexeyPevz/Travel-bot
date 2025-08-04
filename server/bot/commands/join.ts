import { BaseCommand, CommandContext } from './base';
import { storage } from '../../storage';

/**
 * Команда /join - присоединиться к групповому поиску
 */
export class JoinCommand extends BaseCommand {
  name = 'join';
  description = 'Присоединиться к групповому поиску тура';
  usage = '/join';

  async execute(ctx: CommandContext): Promise<void> {
    const { bot, chatId, userId } = ctx;

    try {
      // Проверяем, что команда вызвана в группе
      if (!this.isGroupChat(chatId)) {
        await this.sendMessage(
          bot,
          chatId,
          'Эта команда доступна только в групповых чатах. Добавьте бота в группу и используйте /groupsetup для настройки.'
        );
        return;
      }
      
      // Проверяем профиль пользователя
      const profile = await storage.getProfile(userId);
      
      if (!profile) {
        await this.sendMessage(
          bot,
          chatId,
          'Для участия в групповом поиске сначала необходимо заполнить анкету в личном чате с ботом.',
          {
            reply_markup: {
              inline_keyboard: [[
                { text: 'Начать в личном чате', url: `https://t.me/${(await bot.getMe()).username}?start=from_group` }
              ]]
            }
          }
        );
        return;
      }
      
      // Проверяем, есть ли групповой профиль
      const groupProfile = await storage.getGroupProfile(chatId.toString());
      
      if (!groupProfile) {
        await this.sendMessage(
          bot,
          chatId,
          'Сначала необходимо настроить групповой поиск. Администратор группы должен использовать команду /groupsetup.'
        );
        return;
      }
      
      // Проверяем, не является ли пользователь уже участником
      if (groupProfile.memberIds?.includes(userId)) {
        await this.sendMessage(
          bot,
          chatId,
          `${profile.name}, вы уже участвуете в групповом поиске! ✅`
        );
        return;
      }
      
      // Добавляем пользователя в группу
      const updatedMemberIds = [...(groupProfile.memberIds || []), userId];
      await storage.updateGroupProfile(chatId.toString(), {
        ...groupProfile,
        memberIds: updatedMemberIds
      });
      
      await this.sendMessage(
        bot,
        chatId,
        `🎉 ${profile.name} присоединился к групповому поиску!\n\n` +
        `Участников: ${updatedMemberIds.length}\n` +
        `Когда все соберутся, используйте команду поиска туров.`,
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔍 Искать туры для группы', callback_data: 'group_search_tours' }
            ]]
          }
        }
      );
    } catch (error) {
      await this.sendError(bot, chatId, error as Error);
    }
  }
}