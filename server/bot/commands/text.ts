import TelegramBot from 'node-telegram-bot-api';
import { analyzeTourRequest } from '../../services/openrouter';
import { db } from '../../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import logger from '../../utils/logger';

/**
 * Обработчик свободного текстового запроса на поиск туров
 */
export async function handleFreeTextTourRequest(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  try {
    await bot.sendMessage(chatId, '🔍 Анализирую ваш запрос...');
    
    // Анализируем текст с помощью AI
    const preferences = await analyzeTourRequest(text);
    
    // Сохраняем или обновляем профиль
    const [existingProfile] = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    
    if (existingProfile) {
      await db.update(profiles)
        .set({
          vacationType: preferences.vacationType || existingProfile.vacationType,
          countries: preferences.countries || existingProfile.countries,
          budget: preferences.budget || existingProfile.budget,
          peopleCount: preferences.peopleCount || existingProfile.peopleCount,
          priorities: preferences.priorities || existingProfile.priorities,
          updatedAt: new Date()
        })
        .where(eq(profiles.userId, userId));
    } else {
      await db.insert(profiles)
        .values({
          userId,
          vacationType: preferences.vacationType,
          countries: preferences.countries,
          budget: preferences.budget,
          peopleCount: preferences.peopleCount || 2,
          priorities: preferences.priorities
        });
    }
    
    // Формируем ответ
    let message = '✅ Понял ваш запрос!\n\n';
    
    if (preferences.countries && preferences.countries.length > 0) {
      message += `📍 Направления: ${preferences.countries.join(', ')}\n`;
    }
    if (preferences.budget) {
      message += `💰 Бюджет: ${preferences.budget.toLocaleString('ru-RU')} ₽\n`;
    }
    if (preferences.peopleCount) {
      message += `👥 Количество человек: ${preferences.peopleCount}\n`;
    }
    if (preferences.vacationType) {
      const typeMap: Record<string, string> = {
        'beach': '🏖 Пляжный отдых',
        'active': '🏃‍♂️ Активный отдых',
        'cultural': '🏛 Культурный туризм',
        'relaxing': '🧘‍♀️ Спокойный отдых',
        'family': '👨‍👩‍👧‍👦 Семейный отдых',
        'romantic': '💑 Романтическое путешествие',
        'adventure': '🎒 Приключения'
      };
      message += `🎯 Тип отдыха: ${typeMap[preferences.vacationType] || preferences.vacationType}\n`;
    }
    
    message += '\nНачинаю поиск подходящих туров...';
    
    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Искать туры', callback_data: 'search_tours' }],
          [{ text: '✏️ Уточнить параметры', callback_data: 'edit_profile' }]
        ]
      }
    });
    
    logger.info(`Processed free text tour request for user ${userId}`);
  } catch (error) {
    logger.error('Error handling free text tour request:', error);
    
    await bot.sendMessage(
      chatId,
      'Не удалось проанализировать ваш запрос. Попробуйте сформулировать его иначе или воспользуйтесь анкетой для поиска туров.',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📝 Заполнить анкету', callback_data: 'start_questionnaire' }]
          ]
        }
      }
    );
  }
}

/**
 * Проверяет, является ли текст запросом на поиск тура
 */
export function isTourSearchRequest(text: string): boolean {
  // Ключевые слова для определения запроса на поиск тура
  const keywords = [
    'тур', 'отпуск', 'отдых', 'поездка', 'путешествие',
    'хочу', 'ищу', 'нужен', 'подбери', 'найди',
    'слетать', 'поехать', 'съездить', 'отдохнуть',
    'море', 'пляж', 'горы', 'экскурсии'
  ];
  
  const lowerText = text.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword));
}