import TelegramBot from 'node-telegram-bot-api';
import { Tour } from '@shared/schema';
import logger from '../utils/logger';

/**
 * Отправляет уведомление о найденном туре пользователю
 */
export async function sendTourNotification(
  bot: TelegramBot,
  userId: string,
  tour: Tour,
  matchScore: number
): Promise<void> {
  try {
    const chatId = parseInt(userId);
    
    // Форматируем сообщение о туре
    const message = formatTourMessage(tour, matchScore);
    
    // Отправляем сообщение с кнопками
    await bot.sendMessage(chatId, message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          {
            text: '🔗 Подробнее',
            url: tour.url
          },
          {
            text: '❌ Не интересует',
            callback_data: `dismiss_tour_${tour.id}`
          }
        ]]
      }
    });
    
    logger.info(`Tour notification sent to user ${userId} for tour ${tour.id}`);
  } catch (error) {
    logger.error(`Error sending tour notification to user ${userId}:`, error);
    throw error;
  }
}

/**
 * Форматирует сообщение о туре
 */
function formatTourMessage(tour: Tour, matchScore: number): string {
  const stars = '⭐'.repeat(tour.stars || 0);
  const nights = tour.nights || 0;
  const matchPercent = Math.round(matchScore * 100);
  
  let message = `🎯 <b>Найден подходящий тур!</b> (${matchPercent}% совпадение)\n\n`;
  message += `🏨 <b>${tour.hotelName}</b> ${stars}\n`;
  message += `📍 ${tour.country}, ${tour.region}\n`;
  message += `🌊 ${tour.beachLine ? `${tour.beachLine} линия пляжа` : 'Не у моря'}\n`;
  message += `🍽 ${tour.mealType || 'Питание не указано'}\n`;
  message += `📅 ${nights} ${getNightWord(nights)}\n`;
  message += `💰 <b>${tour.price.toLocaleString('ru-RU')} ₽</b>`;
  
  if (tour.originalPrice && tour.originalPrice > tour.price) {
    const discount = Math.round((1 - tour.price / tour.originalPrice) * 100);
    message += ` <s>${tour.originalPrice.toLocaleString('ru-RU')} ₽</s> (-${discount}%)`;
  }
  
  message += `\n✈️ Вылет: ${tour.departureDate}`;
  
  return message;
}

/**
 * Склонение слова "ночь"
 */
function getNightWord(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'ночей';
  }
  
  if (lastDigit === 1) {
    return 'ночь';
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'ночи';
  }
  
  return 'ночей';
}