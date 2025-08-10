import TelegramBot from 'node-telegram-bot-api';
import { getUserState, setUserState, FSM_STATES, updateUserStateProfile } from './fsm';
import { storage } from '../storage';
import { handleGroupSetupCallback } from './commands/groupsetup';
import { 
  handleGroupReady,
  handleGroupStatus,
  handleGroupSearch,
  handleGroupTourVote
} from './commands/groupEnhanced';
import { handleOnboardingStep, handleSkipPreferences, handleVacationTypeCallback } from './commands/onboarding';
import { MESSAGES } from './messages/templates';
import logger from '../utils/logger';
import { eq } from 'drizzle-orm';
import { groupProfiles, searchTours } from '../db/schema';

export async function handleCallbackQuery(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  try {
    const chatId = callbackQuery.message?.chat.id;
    const userId = callbackQuery.from.id.toString();
    const data = callbackQuery.data;

    if (!chatId || !data) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Invalid callback data' });
      return;
    }

    // Обработка групповых callback
    if (data.startsWith('group_')) {
      await handleGroupCallbacks(bot, callbackQuery);
      return;
    }

    // Group setup
    if (data.startsWith('group_setup')) {
      await handleGroupSetupCallback(bot, callbackQuery);
      return;
    }

    // Start questionnaire
    if (data === 'start_questionnaire') {
      setUserState(userId, {
        state: FSM_STATES.WAITING_NAME,
        profile: { userId }
      });
      
      await bot.sendMessage(
        chatId,
        MESSAGES.onboarding.steps.name,
        { parse_mode: 'Markdown' }
      );
      
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Search tours
    if (data === 'search_tours') {
      const profile = await storage.getProfile(userId);
      
      if (!profile) {
        await bot.sendMessage(
          chatId,
          MESSAGES.errors.noProfile,
          {
            reply_markup: {
              inline_keyboard: [[
                { text: '📝 Заполнить анкету', callback_data: 'start_questionnaire' }
              ]]
            }
          }
        );
      } else {
        await bot.sendMessage(
          chatId,
          MESSAGES.search.searching
        );
        // TODO: Implement tour search
        
        // Запускаем поиск туров для группы
        const groupProfile = await db.select()
          .from(groupProfiles)
          .where(eq(groupProfiles.chatId, chatId.toString()))
          .limit(1);
          
        if (groupProfile[0]) {
          const searchParams = {
            countries: groupProfile[0].countries || [],
            budget: groupProfile[0].budget || 100000,
            startDate: groupProfile[0].startDate || new Date(),
            endDate: groupProfile[0].endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            duration: groupProfile[0].tripDuration || 7,
            adults: groupProfile[0].adults || 2,
            children: groupProfile[0].children || 0
          };
          
          // Выполняем поиск туров
          const tours = await searchTours(searchParams);
          
          if (tours.length > 0) {
            await bot.sendMessage(chatId, 
              `🔍 Найдено ${tours.length} туров по вашим параметрам!\n\n` +
              `Используйте команду /tours для просмотра результатов.`
            );
          } else {
            await bot.sendMessage(chatId, 
              '😔 К сожалению, туры по заданным параметрам не найдены.\n' +
              'Попробуйте изменить критерии поиска.'
            );
          }
        }
      }
      
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Show help
    if (data === 'show_help') {
      await bot.sendMessage(
        chatId, 
        MESSAGES.help.full, 
        { 
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        }
      );
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

    // Vacation type selection
    if (data.startsWith('vacation_')) {
      await handleVacationTypeCallback(bot, callbackQuery);
      return;
    }

    // Skip preferences in onboarding
    if (data === 'skip_preferences') {
      await handleSkipPreferences(bot, callbackQuery);
      return;
    }

    // Answer callback query by default
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Error handling callback query:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Произошла ошибка' });
  }
}

/**
 * Обработка групповых callback
 */
async function handleGroupCallbacks(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const data = callbackQuery.data;
  if (!data) return;

  try {
    // group_ready_123
    if (data.startsWith('group_ready_')) {
      await handleGroupReady(bot, callbackQuery);
      return;
    }

    // group_status_123
    if (data.startsWith('group_status_')) {
      await handleGroupStatus(bot, callbackQuery);
      return;
    }

    // group_search_123
    if (data.startsWith('group_search_')) {
      await handleGroupSearch(bot, callbackQuery);
      return;
    }

    // group_vote_yes_tourId_groupId
    if (data.startsWith('group_vote_')) {
      await handleGroupTourVote(bot, callbackQuery);
      return;
    }

    // group_tour_1_123 (показать конкретный тур)
    if (data.match(/^group_tour_\d+_\d+$/)) {
      const [, , tourId, groupId] = data.split('_');
      const chatId = callbackQuery.message?.chat.id;
      
      if (!chatId) return;
      
      // Получаем информацию о туре
      const tour = await db.select()
        .from(tours)
        .where(eq(tours.id, parseInt(tourId)))
        .limit(1);
        
      if (tour[0]) {
        const tourData = tour[0];
        const message = `🏖 **${tourData.hotelName || 'Отель'}**\n` +
          `📍 ${tourData.country}, ${tourData.region || ''}\n` +
          `⭐ ${tourData.starRating || 0} звезд\n` +
          `🍽 ${tourData.mealType || 'Не указано'}\n` +
          `📅 ${tourData.nights} ночей\n` +
          `💰 ${tourData.price?.toLocaleString('ru-RU')} ₽\n\n` +
          `🔗 [Подробнее](${tourData.link})`;
          
        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '👍 Голосовать', callback_data: `vote_${tourId}_${groupId}` },
              { text: '🔗 Открыть на сайте', url: tourData.link || '' }
            ]]
          }
        });
      }
      
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: 'Детали тура загружены' 
      });
      return;
    }

    // group_members_123 (показать список участников)
    if (data.startsWith('group_members_')) {
      const groupId = data.replace('group_members_', '');
      const chatId = callbackQuery.message?.chat.id;
      
      if (!chatId) return;
      
      // Получаем список участников группы
      const group = await db.select()
        .from(groupProfiles)
        .where(eq(groupProfiles.id, parseInt(groupId)))
        .limit(1);
        
      if (group[0] && group[0].memberUserIds) {
        const memberIds = group[0].memberUserIds as string[];
        const memberNames = group[0].memberNames as string[] || [];
        
        let message = `👥 **Участники группы "${group[0].chatTitle || 'Группа'}":**\n\n`;
        
        memberIds.forEach((userId, index) => {
          const name = memberNames[index] || `Пользователь ${userId}`;
          message += `${index + 1}. ${name}\n`;
        });
        
        message += `\nВсего участников: ${memberIds.length}`;
        
        await bot.sendMessage(chatId, message, {
          parse_mode: 'Markdown'
        });
      } else {
        await bot.sendMessage(chatId, '😔 Информация о группе не найдена');
      }
      
      await bot.answerCallbackQuery(callbackQuery.id);
      return;
    }

  } catch (error) {
    logger.error('Error in group callbacks:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { 
      text: '❌ Произошла ошибка' 
    });
  }
}