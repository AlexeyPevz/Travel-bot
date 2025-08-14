import TelegramBot from 'node-telegram-bot-api';
import { parseTravelRequest, generateResponse, detectTravelStyle } from '../../services/ai-travel-assistant';
import { userProfiles, searchRequests, priorityProfiles } from '@shared/schema-v2';
import { db } from '@/db';
import { eq } from 'drizzle-orm';
import logger from '../../utils/logger';
import { setUserState, getUserState, FSM_STATES } from '../fsm';

/**
 * Тестовая команда для нового AI поиска
 * Работает параллельно с основным функционалом
 */
export async function handleTestAiSearch(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id.toString();
  
  if (!userId) {
    await bot.sendMessage(chatId, '❌ Не удалось определить пользователя');
    return;
  }

  // Проверяем feature flag
  if (process.env.ENABLE_AI_PARSING !== 'true') {
    await bot.sendMessage(chatId, '🚧 Эта функция находится в разработке. Используйте /search для поиска туров.');
    return;
  }

  try {
    // Проверяем/создаем профиль пользователя в новой системе
    let [userProfile] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (!userProfile) {
      // Создаем базовый профиль
      [userProfile] = await db.insert(userProfiles).values({
        userId,
        name: msg.from?.first_name || 'Путешественник',
        departureCity: 'Москва', // Дефолтный город
        language: msg.from?.language_code || 'ru'
      }).returning();
    }

    // Устанавливаем состояние для AI поиска
    setUserState(userId, {
      state: 'AI_SEARCH_WAITING_TEXT' as any,
      searchData: {},
      aiSearchRequest: {
        id: null,
        stage: 'initial'
      }
    });

    const message = `🤖 *Новый AI поиск туров* (тестовый режим)

Просто напишите, какой отдых вы ищете. Например:

💬 _"Хочу в Турцию в августе на недельку, бюджет 150к на двоих, с ребенком 5 лет"_

💬 _"Ищу тихий отель 5 звезд с видом на море, все включено, 2 недели в сентябре"_

💬 _"Нужна вилла с 3 спальнями на Кипре, с кухней и бассейном"_

Я пойму ваш запрос и помогу найти идеальный вариант! ✨`;

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ Отмена', callback_data: 'cancel_ai_search' }
        ]]
      }
    });

  } catch (error) {
    logger.error('Error in AI search command:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже или используйте обычный поиск /search');
  }
}

/**
 * Обработка текстового сообщения в AI поиске
 */
export async function handleAiSearchText(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
) {
  try {
    const state = getUserState(userId);
    if (!state?.aiSearchRequest) return;

    // Показываем, что обрабатываем
    const processingMsg = await bot.sendMessage(chatId, '🤔 Анализирую ваш запрос...');

    // Получаем профиль пользователя
    const [userProfile] = await db.select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    // Парсим запрос через AI
    const parsed = await parseTravelRequest(text, userProfile, state.aiSearchRequest.context);

    // Удаляем сообщение о processing
    await bot.deleteMessage(chatId, processingMsg.message_id);

    // Определяем тип отдыха
    const travelStyle = await detectTravelStyle(text);

    // Получаем соответствующий профиль приоритетов
    const [priorityProfile] = await db.select()
      .from(priorityProfiles)
      .where(eq(priorityProfiles.name, travelStyle))
      .limit(1);

    // Если есть обязательные недостающие параметры
    if (parsed.missingRequired.length > 0) {
      // Генерируем уточняющий ответ
      const response = await generateResponse(parsed, undefined, 'clarify');
      
      // Сохраняем контекст
      state.aiSearchRequest.context = {
        ...state.aiSearchRequest.context,
        lastParsed: parsed,
        clarificationStep: (state.aiSearchRequest.clarificationStep || 0) + 1
      };
      setUserState(userId, state);

      await bot.sendMessage(chatId, response.message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Отмена', callback_data: 'cancel_ai_search' }
          ]]
        }
      });
      return;
    }

    // Все параметры есть, создаем поисковый запрос
    const [searchRequest] = await db.insert(searchRequests).values({
      userId,
      rawText: text,
      destination: parsed.destinations,
      dateType: parsed.dateType,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      flexibleMonth: parsed.flexibleMonth,
      duration: parsed.duration,
      budget: parsed.budget,
      budgetType: parsed.budgetType,
      currency: parsed.currency,
      adults: parsed.adults || 2,
      children: parsed.children || 0,
      childrenAges: parsed.childrenAges,
      roomPreferences: parsed.roomPreferences,
      requirements: parsed.requirements,
      priorities: {
        profileName: travelStyle,
        weights: {
          ...priorityProfile?.weights,
          ...parsed.suggestedPriorities
        }
      },
      status: 'ready'
    }).returning();

    // Генерируем подтверждение
    const confirmResponse = await generateResponse(parsed, undefined, 'confirm');
    
    // Формируем красивое сообщение с параметрами
    let summary = `${confirmResponse.message}\n\n`;
    summary += `📍 **Направление**: ${parsed.destinations?.join(', ') || 'Любое'}\n`;
    
    if (parsed.startDate && parsed.endDate) {
      summary += `📅 **Даты**: ${parsed.startDate.toLocaleDateString('ru-RU')} - ${parsed.endDate.toLocaleDateString('ru-RU')}\n`;
    } else if (parsed.flexibleMonth) {
      summary += `📅 **Месяц**: ${parsed.flexibleMonth}\n`;
    }
    
    if (parsed.duration) {
      summary += `⏱ **Продолжительность**: ${parsed.duration} ночей\n`;
    }
    
    summary += `👥 **Путешественники**: ${parsed.adults || 2} взр.`;
    if (parsed.children) {
      summary += `, ${parsed.children} дет. (${parsed.childrenAges?.join(', ')} лет)`;
    }
    summary += '\n';
    
    if (parsed.budget) {
      summary += `💰 **Бюджет**: ${parsed.budget.toLocaleString('ru-RU')} ₽`;
      summary += parsed.budgetType === 'perPerson' ? ' на человека\n' : ' на всех\n';
    }

    if (parsed.roomPreferences) {
      const room = parsed.roomPreferences;
      summary += '\n🏨 **Предпочтения по номеру**:\n';
      if (room.roomType) summary += `   • Тип: ${room.roomType}\n`;
      if (room.viewPreference) summary += `   • Вид: ${room.viewPreference}\n`;
      if (room.roomsCount) summary += `   • Количество номеров: ${room.roomsCount}\n`;
    }

    summary += `\n🎯 **Стиль отдыха**: ${travelStyle}`;

    await bot.sendMessage(chatId, summary, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔍 Начать поиск', callback_data: `ai_search_start_${searchRequest.id}` },
            { text: '✏️ Изменить', callback_data: `ai_search_edit_${searchRequest.id}` }
          ],
          [
            { text: '⚙️ Настроить приоритеты', callback_data: `ai_search_priorities_${searchRequest.id}` }
          ],
          [
            { text: '❌ Отмена', callback_data: 'cancel_ai_search' }
          ]
        ]
      }
    });

    // Сбрасываем состояние
    setUserState(userId, {
      state: FSM_STATES.IDLE,
      searchData: null,
      aiSearchRequest: null
    });

  } catch (error) {
    logger.error('Error processing AI search text:', error);
    await bot.sendMessage(chatId, '❌ Не удалось обработать запрос. Попробуйте сформулировать иначе или используйте /search');
  }
}