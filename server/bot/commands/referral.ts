import { BaseCommand, CommandContext } from './base';
import { storage } from '../../storage';
import { createReferralCode } from '../../services/referral';

/**
 * Команда /referral - управление реферальной программой
 */
export class ReferralCommand extends BaseCommand {
  name = 'referral';
  description = 'Получить реферальную ссылку';
  usage = '/referral';

  protected async executeCommand(ctx: CommandContext): Promise<void> {
    const { bot, chatId, userId } = ctx;

    try {
      // Получаем профиль пользователя
      const profile = await storage.getProfile(userId);
      
      if (!profile) {
        await this.sendMessage(
          bot,
          chatId,
          'Для использования реферальной программы сначала необходимо заполнить анкету. Используйте /start.'
        );
        return;
      }
      
      // Получаем рефералов
      const referrals = await storage.getReferralsByUser(userId);
      
      // Создаем реферальный код если его нет
      if (!profile.referralCode) {
        const referralCode = await createReferralCode(userId);
        await storage.createOrUpdateProfile({
          ...profile,
          referralCode
        });
      }
      
      const botUsername = (await bot.getMe()).username;
      const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;
      
      let message = `🎁 *Ваша реферальная ссылка:*\n\`${referralLink}\`\n\n`;
      message += `Поделитесь ссылкой с друзьями и получите бонус *500 ₽* за каждого приглашенного пользователя!\n\n`;
      
      if (referrals.length > 0) {
        message += `📊 *Статистика приглашений:*\n`;
        message += `• Количество приглашенных: ${referrals.length}\n`;
        
        // Подсчитываем общий бонус
        const totalBonus = referrals.reduce((sum, ref) => sum + (ref.bonus || 0), 0);
        message += `• Общий бонус: ${this.formatNumber(totalBonus)} ₽\n\n`;
        
        message += `👥 *Последние приглашения:*\n`;
        
        // Показываем последние 5 рефералов
        const lastReferrals = referrals.slice(0, 5);
        lastReferrals.forEach((ref, index) => {
          const name = ref.referred?.name || 'Пользователь';
          message += `${index + 1}. ${name} (+${ref.bonus} ₽)\n`;
        });
      } else {
        message += `У вас пока нет приглашенных пользователей. Поделитесь своей ссылкой с друзьями!`;
      }
      
      // Добавляем кнопки для шаринга
      const shareText = `Я нашел отличного помощника для поиска туров! Присоединяйся: ${referralLink}`;
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(shareText)}`;
      
      await this.sendMessage(bot, chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📤 Поделиться ссылкой', url: shareUrl }],
            [{ text: '📋 Скопировать ссылку', callback_data: `copy_referral_${userId}` }]
          ]
        }
      });
    } catch (error) {
      await this.sendError(bot, chatId, error as Error);
    }
  }
}