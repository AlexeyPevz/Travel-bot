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
import { handleOnboardingStep, handleSkipPreferences } from './commands/onboarding';
import { MESSAGES } from './messages/templates';
import logger from '../utils/logger';

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
      // TODO: Показать детали тура
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: 'Показ деталей тура будет добавлен' 
      });
      return;
    }

    // group_members_123 (показать список участников)
    if (data.startsWith('group_members_')) {
      // TODO: Показать список участников
      await bot.answerCallbackQuery(callbackQuery.id, { 
        text: 'Список участников будет добавлен' 
      });
      return;
    }

  } catch (error) {
    logger.error('Error in group callbacks:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { 
      text: '❌ Произошла ошибка' 
    });
  }
}