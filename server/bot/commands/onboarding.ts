import TelegramBot from 'node-telegram-bot-api';
import { getUserState, setUserState, FSM_STATES, updateUserStateProfile } from '../fsm';
import { storage } from '../../storage';
import { MESSAGES } from '../messages/templates';
import { parseDate, parseDuration, parseBudget } from '../utils/parsers';
import logger from '../../utils/logger';
import { VACATION_TYPE_DESCRIPTIONS, VacationType } from '../../types/vacationTypes';

/**
 * Обработчик шагов онбординга
 */
export async function handleOnboardingStep(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string,
  currentState: FSM_STATES
): Promise<void> {
  try {
    switch (currentState) {
      case FSM_STATES.WAITING_NAME:
        await handleNameStep(bot, chatId, userId, text);
        break;
        
      case FSM_STATES.WAITING_VACATION_TYPE:
        await handleVacationTypeStep(bot, chatId, userId, text);
        break;
        
      case FSM_STATES.WAITING_COUNTRIES:
        await handleCountriesStep(bot, chatId, userId, text);
        break;
        
      case FSM_STATES.WAITING_BUDGET:
        await handleBudgetStep(bot, chatId, userId, text);
        break;
        
      case FSM_STATES.WAITING_DATES:
        await handleDatesStep(bot, chatId, userId, text);
        break;
        
      case FSM_STATES.WAITING_DURATION:
        await handleDurationStep(bot, chatId, userId, text);
        break;
        
      case FSM_STATES.WAITING_TRAVELERS:
        await handleTravelersStep(bot, chatId, userId, text);
        break;
        
      case FSM_STATES.WAITING_PREFERENCES:
        await handlePreferencesStep(bot, chatId, userId, text);
        break;
    }
  } catch (error) {
    logger.error('Error in onboarding step:', error);
    await bot.sendMessage(chatId, MESSAGES.errors.general);
  }
}

/**
 * Шаг 1: Имя
 */
async function handleNameStep(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  name: string
): Promise<void> {
  if (!name || name.length < 2) {
    await bot.sendMessage(
      chatId,
      'Пожалуйста, введите ваше имя (минимум 2 символа)'
    );
    return;
  }

  updateUserStateProfile(userId, { name });
  setUserState(userId, {
    state: FSM_STATES.WAITING_VACATION_TYPE,
    profile: getUserState(userId)?.profile
  });

  // Отправляем выбор типа отдыха с кнопками
  const vacationButtons = [
    [
      { text: '🏖️ Пляжный', callback_data: 'vacation_beach' },
      { text: '🎿 Горнолыжный', callback_data: 'vacation_ski' }
    ],
    [
      { text: '🏛️ Экскурсионный', callback_data: 'vacation_excursion' },
      { text: '🏃 Активный', callback_data: 'vacation_active' }
    ],
    [
      { text: '🧘 Велнес/СПА', callback_data: 'vacation_wellness' },
      { text: '👨‍👩‍👧‍👦 Семейный', callback_data: 'vacation_family' }
    ],
    [
      { text: '🚢 Круизы', callback_data: 'vacation_cruise' },
      { text: '🌿 Экотуризм', callback_data: 'vacation_eco' }
    ],
    [
      { text: '✅ Готово', callback_data: 'vacation_done' }
    ]
  ];

  await bot.sendMessage(
    chatId,
    MESSAGES.onboarding.steps.vacationType,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: vacationButtons
      }
    }
  );
}

/**
 * Шаг 2: Тип отдыха
 */
async function handleVacationTypeStep(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  // Обработка текстового ввода
  const userState = getUserState(userId);
  const selectedTypes = userState?.profile?.vacationType || [];
  
  // Если пользователь написал текст вместо нажатия кнопок
  if (text && !text.startsWith('/')) {
    updateUserStateProfile(userId, { vacationType: text });
    
    setUserState(userId, {
      state: FSM_STATES.WAITING_COUNTRIES,
      profile: getUserState(userId)?.profile
    });

    await bot.sendMessage(
      chatId,
      MESSAGES.onboarding.steps.countries,
      { parse_mode: 'Markdown' }
    );
  }
}

/**
 * Шаг 2: Страны
 */
async function handleCountriesStep(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  const countries = text.toLowerCase() === 'любые' 
    ? [] 
    : text.split(/[,，、]/).map(c => c.trim()).filter(c => c.length > 0);

  updateUserStateProfile(userId, { countries });
  setUserState(userId, {
    state: FSM_STATES.WAITING_BUDGET,
    profile: getUserState(userId)?.profile
  });

  await bot.sendMessage(
    chatId,
    MESSAGES.onboarding.steps.budget,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Шаг 3: Бюджет
 */
async function handleBudgetStep(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  const budget = parseBudget(text);
  
  if (!budget || budget < 10000) {
    await bot.sendMessage(
      chatId,
      'Укажите бюджет числом (минимум 10 000 рублей). Например: 100000 или 100 тысяч'
    );
    return;
  }

  updateUserStateProfile(userId, { budget });
  setUserState(userId, {
    state: FSM_STATES.WAITING_DATES,
    profile: getUserState(userId)?.profile
  });

  await bot.sendMessage(
    chatId,
    MESSAGES.onboarding.steps.dates,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Шаг 4: Даты
 */
async function handleDatesStep(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  const { startDate, endDate } = parseDate(text);
  
  if (!startDate) {
    await bot.sendMessage(
      chatId,
      'Не удалось распознать дату. Попробуйте указать месяц или конкретные даты.'
    );
    return;
  }

  updateUserStateProfile(userId, { startDate, endDate });
  setUserState(userId, {
    state: FSM_STATES.WAITING_DURATION,
    profile: getUserState(userId)?.profile
  });

  await bot.sendMessage(
    chatId,
    MESSAGES.onboarding.steps.duration,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Шаг 5: Длительность
 */
async function handleDurationStep(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  const duration = parseDuration(text);
  
  if (!duration || duration < 1 || duration > 30) {
    await bot.sendMessage(
      chatId,
      'Укажите количество ночей от 1 до 30. Например: 7 или 10-14'
    );
    return;
  }

  updateUserStateProfile(userId, { tripDuration: duration });
  setUserState(userId, {
    state: FSM_STATES.WAITING_TRAVELERS,
    profile: getUserState(userId)?.profile
  });

  await bot.sendMessage(
    chatId,
    MESSAGES.onboarding.steps.travelers,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Шаг 6: Путешественники
 */
async function handleTravelersStep(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  // Простой парсинг количества взрослых и детей
  const adultsMatch = text.match(/(\d+)\s*взросл/i);
  const childrenMatch = text.match(/(\d+)\s*(?:реб|дет)/i);
  const childAgesMatch = text.matchAll(/(?:реб|дет)\w*\s+(\d+)\s*лет/gi);
  
  const adults = adultsMatch ? parseInt(adultsMatch[1]) : 2;
  const children = childrenMatch ? parseInt(childrenMatch[1]) : 0;
  const childrenAges = Array.from(childAgesMatch).map(m => parseInt(m[1]));

  updateUserStateProfile(userId, { 
    adults,
    children,
    childrenAges: childrenAges.length > 0 ? childrenAges : undefined
  });
  
  setUserState(userId, {
    state: FSM_STATES.WAITING_PREFERENCES,
    profile: getUserState(userId)?.profile
  });

  await bot.sendMessage(
    chatId,
    MESSAGES.onboarding.steps.preferences,
    { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: 'Пропустить ⏩', callback_data: 'skip_preferences' }
        ]]
      }
    }
  );
}

/**
 * Шаг 7: Предпочтения
 */
async function handlePreferencesStep(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  if (text !== 'skip') {
    // Сохраняем предпочтения как есть
    updateUserStateProfile(userId, { preferences: text });
  }

  // Завершаем онбординг
  await completeOnboarding(bot, chatId, userId);
}

/**
 * Завершение онбординга
 */
async function completeOnboarding(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const userState = getUserState(userId);
  if (!userState || !userState.profile) return;

  // Сохраняем профиль в базу
  await storage.saveProfile({
    ...userState.profile,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
    isActive: true
  });

  // Сбрасываем состояние
  setUserState(userId, {
    state: FSM_STATES.IDLE,
    profile: userState.profile
  });

  await bot.sendMessage(
    chatId,
    MESSAGES.onboarding.complete,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔍 Найти туры', callback_data: 'search_tours' }],
          [{ text: '👤 Мой профиль', callback_data: 'show_profile' }]
        ]
      }
    }
  );
}

/**
 * Обработчик пропуска предпочтений
 */
export async function handleSkipPreferences(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const userId = callbackQuery.from.id.toString();
  
  if (!chatId) return;

  await bot.answerCallbackQuery(callbackQuery.id, { 
    text: 'Предпочтения пропущены' 
  });
  
  await completeOnboarding(bot, chatId, userId);
}

/**
 * Обработчик выбора типа отдыха через callback
 */
export async function handleVacationTypeCallback(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const userId = callbackQuery.from.id.toString();
  const data = callbackQuery.data;
  
  if (!chatId || !data) return;

  const userState = getUserState(userId);
  let selectedTypes = userState?.profile?.selectedVacationTypes || [];

  if (data === 'vacation_done') {
    if (selectedTypes.length === 0) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Выберите хотя бы один тип отдыха',
        show_alert: true
      });
      return;
    }

    // Сохраняем выбранные типы
    updateUserStateProfile(userId, { 
      vacationType: selectedTypes.join(', '),
      selectedVacationTypes: selectedTypes 
    });
    
    setUserState(userId, {
      state: FSM_STATES.WAITING_COUNTRIES,
      profile: getUserState(userId)?.profile
    });

    await bot.answerCallbackQuery(callbackQuery.id);
    
    // Отправляем следующий шаг
    await bot.sendMessage(
      chatId,
      MESSAGES.onboarding.steps.countries,
      { parse_mode: 'Markdown' }
    );
    
    // Удаляем кнопки
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      {
        chat_id: chatId,
        message_id: callbackQuery.message?.message_id
      }
    );
    
    return;
  }

  // Обработка выбора типа
  const vacationType = data.replace('vacation_', '');
  
  if (selectedTypes.includes(vacationType)) {
    // Убираем из выбранных
    selectedTypes = selectedTypes.filter(t => t !== vacationType);
  } else {
    // Добавляем в выбранные
    selectedTypes.push(vacationType);
  }

  // Обновляем состояние
  updateUserStateProfile(userId, { selectedVacationTypes: selectedTypes });

  // Обновляем кнопки с галочками
  const vacationButtons = [
    [
      { 
        text: `${selectedTypes.includes('beach') ? '✅ ' : ''}🏖️ Пляжный`, 
        callback_data: 'vacation_beach' 
      },
      { 
        text: `${selectedTypes.includes('ski') ? '✅ ' : ''}🎿 Горнолыжный`, 
        callback_data: 'vacation_ski' 
      }
    ],
    [
      { 
        text: `${selectedTypes.includes('excursion') ? '✅ ' : ''}🏛️ Экскурсионный`, 
        callback_data: 'vacation_excursion' 
      },
      { 
        text: `${selectedTypes.includes('active') ? '✅ ' : ''}🏃 Активный`, 
        callback_data: 'vacation_active' 
      }
    ],
    [
      { 
        text: `${selectedTypes.includes('wellness') ? '✅ ' : ''}🧘 Велнес/СПА`, 
        callback_data: 'vacation_wellness' 
      },
      { 
        text: `${selectedTypes.includes('family') ? '✅ ' : ''}👨‍👩‍👧‍👦 Семейный`, 
        callback_data: 'vacation_family' 
      }
    ],
    [
      { 
        text: `${selectedTypes.includes('cruise') ? '✅ ' : ''}🚢 Круизы`, 
        callback_data: 'vacation_cruise' 
      },
      { 
        text: `${selectedTypes.includes('eco') ? '✅ ' : ''}🌿 Экотуризм`, 
        callback_data: 'vacation_eco' 
      }
    ],
    [
      { text: '✅ Готово', callback_data: 'vacation_done' }
    ]
  ];

  await bot.editMessageReplyMarkup(
    { inline_keyboard: vacationButtons },
    {
      chat_id: chatId,
      message_id: callbackQuery.message?.message_id
    }
  );

  await bot.answerCallbackQuery(callbackQuery.id, {
    text: selectedTypes.length > 0 
      ? `Выбрано типов: ${selectedTypes.length}` 
      : 'Ничего не выбрано'
  });
}