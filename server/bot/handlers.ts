import TelegramBot from 'node-telegram-bot-api';
import { commandRegistry, CommandContext } from './commands';
import { handleFreeTextTourRequest, isTourSearchRequest } from './commands/text';
import { getUserState, setUserState, FSM_STATES } from './fsm';
import { handleCallbackQuery } from './callbacks';
import logger from '../utils/logger';
import { 
  handleDepartureCity, 
  handleAdultsCount, 
  handleChildrenCount,
  handleChildrenAges,
  handleChildrenInfo,
    handleTripDuration,
    handleBudget,
  performTourSearch,
  startTourSearchFlow
} from './commands/searchFlow';
import { handleOnboardingStep, handleSkipPreferences } from './commands/onboarding';

/**
 * Обработчик команд бота
 */
export async function handleCommand(
  bot: TelegramBot, 
  chatId: number, 
  userId: string, 
  commandText: string,
  message?: TelegramBot.Message
): Promise<void> {
  try {
    // Извлекаем имя команды и параметры
    const parts = commandText.split(' ');
    const commandName = parts[0];
    const params = parts.slice(1);

    // Ищем команду в регистре
    const command = commandRegistry.getCommand(commandName);
    
    if (command) {
      // Создаем контекст для команды
      const context: CommandContext = {
        bot,
        chatId,
        userId,
        message,
        params
      };
      
      // Выполняем команду
      await command.execute(context);
    } else {
      await bot.sendMessage(chatId, 'Неизвестная команда. Используйте /help для списка доступных команд.');
    }
  } catch (error) {
    logger.error(`Error handling command ${commandText}:`, error);
    await bot.sendMessage(chatId, 'Произошла ошибка при обработке команды. Пожалуйста, попробуйте еще раз.');
  }
}

/**
 * Обработчик текстовых сообщений
 */
export async function handleMessage(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string,
  message: TelegramBot.Message
): Promise<void> {
  try {
    // Проверяем состояние FSM пользователя
    const userState = getUserState(userId);
    
    // Если пользователь в процессе заполнения анкеты или поиска
    if (userState && userState.state !== FSM_STATES.IDLE) {
      // Обрабатываем через FSM
      await handleFSMInput(bot, chatId, userId, text, userState);
      return;
    }
    
    // Проверяем, является ли это запросом на поиск тура
    if (isTourSearchRequest(text)) {
      await handleFreeTextTourRequest(bot, chatId, userId, text);
      return;
    }
    
    // Обычное текстовое сообщение - предлагаем варианты действий
    await bot.sendMessage(
      chatId,
      'Я могу помочь вам найти идеальный тур! Что вы хотите сделать?',
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔍 Найти тур', callback_data: 'search_tours' }],
            [{ text: '📝 Заполнить анкету', callback_data: 'start_questionnaire' }],
            [{ text: '❓ Помощь', callback_data: 'show_help' }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error('Error handling message:', error);
    await bot.sendMessage(chatId, 'Произошла ошибка при обработке сообщения. Пожалуйста, попробуйте еще раз.');
  }
}

/**
 * Обработчик inline кнопок
 */
export async function handleCallback(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  try {
    if (!callbackQuery.from || !callbackQuery.data) {
      return;
    }
    
    const chatId = callbackQuery.message?.chat.id;
    if (!chatId) {
      return;
    }
    
    const userId = callbackQuery.from.id.toString();
    const data = callbackQuery.data;
    
    // Обработка callback для поиска
    if (data.startsWith('search_')) {
      await handleSearchCallbacks(bot, chatId, userId, data, callbackQuery);
      return;
    }
    
    // Остальные callbacks обрабатываются как раньше
    await handleCallbackQuery(bot, callbackQuery);
    
  } catch (error) {
    logger.error('Error handling callback:', error);
    if (callbackQuery.message?.chat.id) {
      await bot.sendMessage(
        callbackQuery.message.chat.id,
        'Произошла ошибка при обработке запроса. Попробуйте еще раз.'
      );
    }
  }
}

/**
 * Обработка callback для поиска туров
 */
async function handleSearchCallbacks(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  data: string,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  // Отвечаем на callback query
  await bot.answerCallbackQuery(callbackQuery.id);
  
  switch (data) {
    case 'search_tours':
      // Перед стартом поиска проверим, что профиль существует, иначе предложим заполнить
      try {
        const { db } = await import('../../db');
        const { profiles } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');
        const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1);
        if (!profile) {
          await bot.sendMessage(chatId, 'Сначала заполните профиль: это поможет подобрать туры точнее.', {
            reply_markup: {
              inline_keyboard: [[{ text: '📝 Заполнить анкету', callback_data: 'start_questionnaire' }]]
            }
          });
          break;
        }
      } catch {}
      await startTourSearchFlow(bot, chatId, userId, '');
      break;
    case 'search_no_children':
      await handleChildrenInfo(bot, chatId, userId, false);
      break;
      
    case 'search_has_children':
      await handleChildrenInfo(bot, chatId, userId, true);
      break;
      
    // Обработчики звездности
    case 'search_stars_3':
      await import('./commands/searchFlow').then(m => m.handleStarRating(bot, chatId, userId, '3'));
      break;
    case 'search_stars_4':
      await import('./commands/searchFlow').then(m => m.handleStarRating(bot, chatId, userId, '4'));
      break;
    case 'search_stars_5':
      await import('./commands/searchFlow').then(m => m.handleStarRating(bot, chatId, userId, '5'));
      break;
    case 'search_stars_any':
      await import('./commands/searchFlow').then(m => m.handleStarRating(bot, chatId, userId, 'any'));
      break;
      
    // Обработчики типа питания
    case 'search_meal_ai':
      await import('./commands/searchFlow').then(m => m.handleMealType(bot, chatId, userId, 'ai'));
      break;
    case 'search_meal_bb':
      await import('./commands/searchFlow').then(m => m.handleMealType(bot, chatId, userId, 'bb'));
      break;
    case 'search_meal_hb':
      await import('./commands/searchFlow').then(m => m.handleMealType(bot, chatId, userId, 'hb'));
      break;
    case 'search_meal_fb':
      await import('./commands/searchFlow').then(m => m.handleMealType(bot, chatId, userId, 'fb'));
      break;
    case 'search_meal_any':
      await import('./commands/searchFlow').then(m => m.handleMealType(bot, chatId, userId, 'any'));
      break;
      
    case 'search_confirm':
      await performTourSearch(bot, chatId, userId);
      break;
      
    case 'search_edit':
      // Упрощённое редактирование: перезапускаем FSM с сохранёнными данными
      await bot.sendMessage(chatId, 'Изменим параметры. Начнём с города вылета.');
      {
        const { getUserState, FSM_STATES, setUserState } = await import('./fsm');
        const state = getUserState(userId);
        if (state?.searchData) {
          state.state = FSM_STATES.SEARCH_WAITING_DEPARTURE_CITY;
          setUserState(userId, state);
        }
        const { askDepartureCity } = await import('./commands/searchFlow');
        await askDepartureCity(bot, chatId);
      }
      break;
      
    case 'search_cancel':
      setUserState(userId, {
        state: FSM_STATES.IDLE,
        profile: { userId }
      });
      await bot.sendMessage(chatId, 'Поиск отменен. Вы можете начать новый поиск в любое время.');
      break;
  }
}

/**
 * Обработчик ввода в зависимости от состояния FSM
 */
async function handleFSMInput(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string,
  userState: any
): Promise<void> {
  const state = userState.state as FSM_STATES;
  
  // Онбординг
  if ([
    FSM_STATES.WAITING_NAME,
    FSM_STATES.WAITING_VACATION_TYPE,
    FSM_STATES.WAITING_COUNTRIES,
    FSM_STATES.WAITING_BUDGET,
    FSM_STATES.WAITING_DATES,
    FSM_STATES.WAITING_DURATION,
    FSM_STATES.WAITING_TRAVELERS,
    FSM_STATES.WAITING_PREFERENCES
  ].includes(state)) {
    await handleOnboardingStep(bot, chatId, userId, text, state);
    return;
  }
  
  // Поиск туров
  switch (state) {
    case FSM_STATES.SEARCH_WAITING_DEPARTURE_CITY:
      await handleDepartureCity(bot, chatId, userId, text);
      break;
      
    case FSM_STATES.SEARCH_WAITING_ADULTS_COUNT:
      await handleAdultsCount(bot, chatId, userId, text);
      break;
      
    case FSM_STATES.SEARCH_WAITING_CHILDREN_COUNT:
      await handleChildrenCount(bot, chatId, userId, text);
      break;
      
    case FSM_STATES.SEARCH_WAITING_CHILDREN_AGES:
      await handleChildrenAges(bot, chatId, userId, text);
      break;
    case FSM_STATES.SEARCH_WAITING_DURATION:
      await handleTripDuration(bot, chatId, userId, text);
      break;
    case FSM_STATES.SEARCH_WAITING_BUDGET:
      await handleBudget(bot, chatId, userId, text);
      break;
      
    case FSM_STATES.SEARCH_WAITING_STAR_RATING:
      await import('./commands/searchFlow').then(m => m.handleStarRating(bot, chatId, userId, text));
      break;
      
    case FSM_STATES.SEARCH_WAITING_MEAL_TYPE:
      // Если пользователь написал текстом вместо кнопок
      await bot.sendMessage(chatId, 'Пожалуйста, используйте кнопки для выбора типа питания');
      break;
      
    default:
      logger.warn(`Unhandled FSM state: ${state}`);
      await bot.sendMessage(
        chatId,
        'Произошла ошибка. Попробуйте начать заново с /start'
      );
  }
}

// Экспортируем все необходимые функции
export * from './callbacks';
export * from './fsm';
export * from './utils';
export * from './commands';
