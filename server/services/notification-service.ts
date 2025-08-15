import { db } from '@/db';
import { notifications } from '@shared/schema-v2';
import { eq } from 'drizzle-orm';
import TelegramBot from 'node-telegram-bot-api';
import logger from '../utils/logger';

let bot: TelegramBot | null = null;

/**
 * Инициализация бота для отправки уведомлений
 */
export function initNotificationBot(telegramBot: TelegramBot) {
  bot = telegramBot;
}

/**
 * Отправляет уведомление пользователю
 */
export async function sendNotification(notificationId: number) {
  try {
    // Получаем уведомление из БД
    const [notification] = await db.select()
      .from(notifications)
      .where(eq(notifications.id, notificationId))
      .limit(1);

    if (!notification) {
      logger.error(`Notification ${notificationId} not found`);
      return;
    }

    // Проверяем статус
    if (notification.deliveryStatus === 'sent') {
      logger.warn(`Notification ${notificationId} already sent`);
      return;
    }

    // Отправляем в зависимости от канала
    switch (notification.deliveryChannel) {
      case 'telegram':
        await sendTelegramNotification(notification);
        break;
      
      case 'email':
        // TODO: Implement email notifications
        logger.warn('Email notifications not implemented yet');
        break;
      
      case 'push':
        // TODO: Implement push notifications
        logger.warn('Push notifications not implemented yet');
        break;
      
      default:
        logger.error(`Unknown delivery channel: ${notification.deliveryChannel}`);
    }

  } catch (error) {
    logger.error(`Error sending notification ${notificationId}:`, error);
    
    // Обновляем статус на failed
    await db.update(notifications)
      .set({
        deliveryStatus: 'failed',
        deliveryError: (error as Error).message
      })
      .where(eq(notifications.id, notificationId));
  }
}

/**
 * Отправляет уведомление через Telegram
 */
async function sendTelegramNotification(notification: typeof notifications.$inferSelect) {
  if (!bot) {
    throw new Error('Telegram bot not initialized');
  }

  try {
    const chatId = notification.userId; // В Telegram userId = chatId
    
    // Формируем сообщение
    let message = `*${escapeMarkdown(notification.title)}*\n\n`;
    message += escapeMarkdown(notification.message);

    // Добавляем кнопки действий
    const keyboard: TelegramBot.InlineKeyboardButton[][] = [];
    
    if (notification.actionUrl) {
      keyboard.push([{
        text: '🔗 Посмотреть тур',
        url: notification.actionUrl
      }]);
    }
    
    if (notification.actionData && (notification.actionData as any).callback) {
      keyboard.push([{
        text: '👁 Подробнее',
        callback_data: (notification.actionData as any).callback
      }]);
    }
    
    // Добавляем кнопки управления фоновым поиском
    if (notification.type === 'background_search' && notification.sourceId) {
      keyboard.push([
        {
          text: '⏸ Приостановить',
          callback_data: `bg_pause_${notification.sourceId}`
        },
        {
          text: '❌ Остановить',
          callback_data: `bg_stop_${notification.sourceId}`
        }
      ]);
    }
    
    keyboard.push([{
      text: '✅ Прочитано',
      callback_data: `notif_read_${notification.id}`
    }]);

    // Отправляем сообщение
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: keyboard.length > 0 ? {
        inline_keyboard: keyboard
      } : undefined
    });

    // Обновляем статус
    await db.update(notifications)
      .set({
        deliveryStatus: 'sent',
        sentAt: new Date()
      })
      .where(eq(notifications.id, notification.id));

    logger.info(`Notification ${notification.id} sent to user ${notification.userId}`);

  } catch (error) {
    logger.error(`Error sending Telegram notification:`, error);
    throw error;
  }
}

/**
 * Экранирует специальные символы для Markdown
 */
function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+-=|{}.!]/g, '\\$&');
}

/**
 * Отмечает уведомление как прочитанное
 */
export async function markNotificationAsRead(notificationId: number, userId: string) {
  await db.update(notifications)
    .set({
      isRead: true,
      readAt: new Date()
    })
    .where(
      eq(notifications.id, notificationId)
    );
}

/**
 * Получает непрочитанные уведомления пользователя
 */
export async function getUnreadNotifications(userId: string) {
  return await db.select()
    .from(notifications)
    .where(
      eq(notifications.userId, userId)
    )
    .orderBy(notifications.createdAt);
}

/**
 * Отправляет массовые уведомления (для админов)
 */
export async function sendBulkNotification(
  userIds: string[],
  title: string,
  message: string,
  type: string = 'system'
) {
  const notificationPromises = userIds.map(userId =>
    db.insert(notifications).values({
      userId,
      type,
      title,
      message
    }).returning()
  );

  const createdNotifications = await Promise.all(notificationPromises);
  
  // Отправляем все уведомления
  for (const [notification] of createdNotifications) {
    await sendNotification(notification.id);
  }
  
  return createdNotifications.length;
}