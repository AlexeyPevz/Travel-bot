import TelegramBot from 'node-telegram-bot-api';
import { analyzeTourRequest } from '../../services/openrouter';
import { db } from '../../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import logger from '../../utils/logger';
import { startTourSearchFlow } from './searchFlow';

/**
 * Обработчик свободного текстового запроса на поиск туров
 * Теперь запускает новый flow с обязательными параметрами
 */
export async function handleFreeTextTourRequest(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  try {
    // Запускаем новый flow поиска
    await startTourSearchFlow(bot, chatId, userId, text);
  } catch (error) {
    logger.error('Error handling free text tour request:', error);
    await bot.sendMessage(
      chatId,
      '❌ Произошла ошибка при обработке запроса. Пожалуйста, попробуйте еще раз.'
    );
  }
}

/**
 * Определяет, является ли текст запросом на поиск тура
 * @param text Текст сообщения
 * @returns true если это запрос на поиск тура
 */
export function isTourSearchRequest(text: string): boolean {
  const tourKeywords = [
    'тур', 'путевка', 'отдых', 'поездка', 'хочу', 'ищу', 'найди', 
    'море', 'пляж', 'отель', 'египет', 'турция', 'тунис', 'греция',
    'кипр', 'мальдивы', 'тайланд', 'оаэ', 'вьетнам', 'доминикана',
    'куба', 'мексика', 'бали', 'все включено', 'all inclusive',
    'бюджет', 'недорого', 'дешево', 'эконом', 'премиум',
    'семейный', 'романтический', 'молодежный', 'спокойный',
    'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
    'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
    'лет', 'слет', 'вылет', 'полет'
  ];
  
  const lowerText = text.toLowerCase();
  
  // Проверяем наличие ключевых слов
  const hasKeyword = tourKeywords.some(keyword => lowerText.includes(keyword));
  
  // Проверяем наличие цен
  const pricePattern = /\d+\s*(тыс|тысяч|руб|рублей|₽|\$|€|usd|eur)/i;
  const hasPrice = pricePattern.test(text);
  
  // Проверяем наличие дат
  const datePattern = /\d{1,2}\s*(янв|фев|мар|апр|май|июн|июл|авг|сен|окт|ноя|дек)|с\s*\d{1,2}/i;
  const hasDate = datePattern.test(text);
  
  // Если есть хотя бы одно ключевое слово и (цена или дата), считаем это запросом тура
  return hasKeyword || (hasPrice && hasDate);
}

/**
 * Анализирует текст и извлекает параметры тура (устаревшая функция, оставлена для совместимости)
 * @deprecated Используйте startTourSearchFlow вместо этой функции
 */
export async function extractTourParams(text: string): Promise<any> {
  return await analyzeTourRequest(text);
}