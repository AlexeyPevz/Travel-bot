import TelegramBot from 'node-telegram-bot-api';
import { storage } from '../storage';
import { getUserState, setUserState, resetUserState, FSM_STATES } from './fsm';
import { getAllTours } from '../services/toursService';
import { createReferralCode, addReferral } from '../services/referral';
import { scheduleTourNotification } from '../services/scheduler';
import { sendIntroCards } from './utils/onboarding';

export async function handleCommand(
  bot: TelegramBot, 
  chatId: number, 
  userId: string, 
  command: string
): Promise<void> {
  try {
    switch (command) {
      case '/start':
        await handleStartCommand(bot, chatId, userId);
        break;
      case '/help':
        await handleHelpCommand(bot, chatId, userId);
        break;
      case '/myrequests':
        await handleMyRequestsCommand(bot, chatId, userId);
        break;
      case '/referral':
        await handleReferralCommand(bot, chatId, userId);
        break;
      case '/join':
        await handleJoinCommand(bot, chatId, userId);
        break;
      case '/groupsetup':
        await handleGroupSetupCommand(bot, chatId, userId);
        break;
      default:
        await bot.sendMessage(chatId, 'Неизвестная команда. Используйте /start для начала работы.');
    }
  } catch (error) {
    console.error(`Error handling command ${command}:`, error);
    await bot.sendMessage(chatId, 'Произошла ошибка при обработке команды. Пожалуйста, попробуйте еще раз.');
  }
}

export async function handleDeepLink(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  referrerId: string
): Promise<void> {
  try {
    // Check if referrer exists
    const referrer = await storage.getProfile(referrerId);
    
    if (referrer) {
      // Check if this is a new user
      const userProfile = await storage.getProfile(userId);
      
      if (!userProfile) {
        // New user, register referral
        await addReferral(referrerId, userId);
        
        await bot.sendMessage(
          chatId,
          `Добро пожаловать! Вы перешли по реферальной ссылке от ${referrer.name}. Вы получите бонус после заполнения анкеты.`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `С возвращением! Вы уже зарегистрированы в системе.`
        );
      }
    }
    
    // Continue with regular start flow
    await handleStartCommand(bot, chatId, userId);
  } catch (error) {
    console.error('Error handling deep link:', error);
    await bot.sendMessage(
      chatId,
      'Произошла ошибка при обработке реферальной ссылки. Пожалуйста, начните заново с /start.'
    );
  }
}

async function handleStartCommand(bot: TelegramBot, chatId: number, userId: string): Promise<void> {
  try {
    // Reset user state
    resetUserState(userId);
    
    // Check if user already has a profile
    const existingProfile = await storage.getProfile(userId);
    
    if (existingProfile) {
      // Returning user
      const keyboard = {
        inline_keyboard: [
          [{ text: 'Открыть приложение', web_app: { url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/profile` } }],
          [{ text: 'Редактировать анкету', callback_data: 'edit_profile' }],
          [{ text: 'Показать туры', callback_data: 'show_tours' }]
        ]
      };
      
      await bot.sendMessage(
        chatId,
        `Рады видеть вас снова, ${existingProfile.name}! Что бы вы хотели сделать?`,
        { reply_markup: keyboard }
      );
      
      // Для существующих пользователей не показываем онбординг автоматически
      // Они могут вызвать его командой /help при необходимости
    } else {
      // Новый пользователь - отправляем карточки онбординга
      await sendIntroCards(bot, chatId, userId);
    }
  } catch (error) {
    console.error('Error handling start command:', error);
    await bot.sendMessage(
      chatId,
      'Произошла ошибка при обработке команды. Пожалуйста, попробуйте еще раз.'
    );
  }
}

async function handleMyRequestsCommand(bot: TelegramBot, chatId: number, userId: string): Promise<void> {
  try {
    // Get user profile
    const profile = await storage.getProfile(userId);
    
    if (!profile) {
      await bot.sendMessage(
        chatId,
        'Для использования этой команды сначала необходимо заполнить анкету. Используйте /start.'
      );
      return;
    }
    
    // Get active watchlists
    const watchlists = await storage.getWatchlists(userId);
    
    if (watchlists.length === 0) {
      await bot.sendMessage(
        chatId,
        'У вас пока нет активных запросов. Вы можете создать новый запрос в приложении.',
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Открыть приложение', web_app: { url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/watchlist` } }]
            ]
          }
        }
      );
      return;
    }
    
    // Format watchlists
    let message = 'Ваши активные запросы:\n\n';
    
    watchlists.forEach((watchlist, index) => {
      message += `${index + 1}. ${watchlist.destination}\n`;
      message += `   Бюджет: ${watchlist.budget ? `${watchlist.budget} ₽` : 'не указан'}\n`;
      message += `   Длительность: ${watchlist.tripDuration || 'не указана'} дней\n`;
      message += `   Статус: ${watchlist.active ? 'активный' : 'приостановлен'}\n`;
      
      if (watchlist.deadline) {
        const daysLeft = Math.floor((new Date(watchlist.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        message += `   Срок ожидания: ${daysLeft > 0 ? `осталось ${daysLeft} дней` : 'истек'}\n`;
      }
      
      message += '\n';
    });
    
    await bot.sendMessage(chatId, message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Управление запросами', web_app: { url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/watchlist` } }]
        ]
      }
    });
  } catch (error) {
    console.error('Error handling myrequests command:', error);
    await bot.sendMessage(
      chatId,
      'Произошла ошибка при получении ваших запросов. Пожалуйста, попробуйте позже.'
    );
  }
}

async function handleReferralCommand(bot: TelegramBot, chatId: number, userId: string): Promise<void> {
  try {
    // Get user profile
    const profile = await storage.getProfile(userId);
    
    if (!profile) {
      await bot.sendMessage(
        chatId,
        'Для использования реферальной программы сначала необходимо заполнить анкету. Используйте /start.'
      );
      return;
    }
    
    // Get referrals
    const referrals = await storage.getReferralsByUser(userId);
    
    // Create referral link if not exists
    if (!profile.referralCode) {
      const referralCode = await createReferralCode(userId);
      await storage.createOrUpdateProfile({
        ...profile,
        referralCode
      });
    }
    
    const botUsername = (await bot.getMe()).username;
    const referralLink = `https://t.me/${botUsername}?start=ref_${userId}`;
    
    let message = `🎁 Ваша реферальная ссылка: ${referralLink}\n\n`;
    message += `Поделитесь ссылкой с друзьями и получите бонус 500 ₽ за каждого приглашенного пользователя!\n\n`;
    
    if (referrals.length > 0) {
      message += `Статистика приглашений:\n`;
      message += `- Количество приглашенных: ${referrals.length}\n`;
      
      // Calculate total bonus
      const totalBonus = referrals.reduce((sum, ref) => sum + (ref.bonus || 0), 0);
      message += `- Общий бонус: ${totalBonus} ₽\n\n`;
      
      message += `Последние приглашения:\n`;
      
      // Show last 5 referrals
      const lastReferrals = referrals.slice(0, 5);
      lastReferrals.forEach((ref, index) => {
        const name = ref.referred?.name || 'Пользователь';
        message += `${index + 1}. ${name} (+${ref.bonus} ₽)\n`;
      });
    } else {
      message += `У вас пока нет приглашенных пользователей. Поделитесь своей ссылкой с друзьями!`;
    }
    
    await bot.sendMessage(chatId, message);
  } catch (error) {
    console.error('Error handling referral command:', error);
    await bot.sendMessage(
      chatId,
      'Произошла ошибка при получении данных о реферальной программе. Пожалуйста, попробуйте позже.'
    );
  }
}

/**
 * Обработчик команды /help
 * Показывает помощь и карточки онбординга вне зависимости от того, видел их пользователь или нет
 */
async function handleHelpCommand(bot: TelegramBot, chatId: number, userId: string): Promise<void> {
  try {
    // Проверяем существование чата перед отправкой
    try {
      await bot.getChat(chatId);
    } catch (chatError) {
      console.warn(`Чат ${chatId} не найден. Возможно, пользователь заблокировал бота или чат был удален.`);
      return; // Прекращаем обработку, если чат не существует
    }
    
    // Сначала отправляем список доступных команд
    await bot.sendMessage(
      chatId,
      'Вот список доступных команд:\n' +
      '/start - Начать работу с ботом\n' +
      '/help - Показать эту помощь и карточки функций\n' +
      '/myrequests - Просмотреть ваши сохраненные запросы\n' +
      '/referral - Получить реферальную ссылку'
    );
    
    // Затем отправляем карточки онбординга с флагом force=true
    await sendIntroCards(bot, chatId, userId, true);
    console.log(`Успешно отправлены карточки помощи для пользователя ${userId} в чат ${chatId}`);
  } catch (error) {
    console.error('Error handling help command:', error);
    try {
      await bot.sendMessage(
        chatId,
        'Произошла ошибка при отображении помощи. Пожалуйста, попробуйте еще раз позже.'
      );
    } catch (msgError) {
      console.error('Не удалось отправить сообщение об ошибке:', msgError);
    }
  }
}

async function handleJoinCommand(bot: TelegramBot, chatId: number, userId: string): Promise<void> {
  try {
    // Only works in group chats
    const chat = await bot.getChat(chatId);
    
    if (chat.type === 'private') {
      await bot.sendMessage(
        chatId,
        'Эта команда работает только в групповых чатах.'
      );
      return;
    }
    
    // Get user profile
    const profile = await storage.getProfile(userId);
    
    if (!profile) {
      await bot.sendMessage(
        chatId,
        'Для присоединения к группе сначала необходимо заполнить личную анкету. Используйте /start в личных сообщениях с ботом.'
      );
      return;
    }
    
    // Add user to group
    const chatIdStr = chatId.toString();
    const groupId = await storage.addUserToGroup(chatIdStr, userId);
    
    if (groupId) {
      await bot.sendMessage(
        chatId,
        `Пользователь ${profile.name} успешно присоединился к группе!`
      );
    } else {
      // Create new group profile
      const groupName = chat.title || 'Групповая поездка';
      
      await storage.createOrUpdateGroupProfile({
        chatId: chatIdStr,
        name: groupName,
        members: [userId]
      });
      
      await bot.sendMessage(
        chatId,
        `Создана новая группа "${groupName}"!\n\nПользователь ${profile.name} стал первым участником. Остальные участники чата могут присоединиться, отправив команду /join.`
      );
    }
  } catch (error) {
    console.error('Error handling join command:', error);
    await bot.sendMessage(
      chatId,
      'Произошла ошибка при присоединении к группе. Пожалуйста, попробуйте позже.'
    );
  }
}

async function handleGroupSetupCommand(bot: TelegramBot, chatId: number, userId: string): Promise<void> {
  try {
    // Only works in group chats
    const chat = await bot.getChat(chatId);
    
    if (chat.type === 'private') {
      await bot.sendMessage(
        chatId,
        'Эта команда работает только в групповых чатах.'
      );
      return;
    }
    
    // Check if group already exists
    const chatIdStr = chatId.toString();
    const groupProfile = await storage.getGroupProfile(chatIdStr);
    
    if (!groupProfile || !groupProfile.members || groupProfile.members.length === 0) {
      await bot.sendMessage(
        chatId,
        'Сначала участники должны присоединиться к группе с помощью команды /join.'
      );
      return;
    }
    
    // Send group setup message
    await bot.sendMessage(
      chatId,
      `Настройка групповой поездки для "${chat.title || 'Групповая поездка'}"!\n\nУчастники группы (${groupProfile.members.length}):\n${groupProfile.members.map((m, i) => `${i + 1}. Участник #${m}`).join('\n')}\n\nДля настройки общего профиля группы и поиска туров, подходящих всем участникам, нажмите кнопку ниже:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Настроить группу', web_app: { url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/groups?chatId=${chatIdStr}` } }]
          ]
        }
      }
    );
  } catch (error) {
    console.error('Error handling groupsetup command:', error);
    await bot.sendMessage(
      chatId,
      'Произошла ошибка при настройке группы. Пожалуйста, попробуйте позже.'
    );
  }
}

export async function handleMessage(
  bot: TelegramBot, 
  chatId: number, 
  userId: string, 
  msg: TelegramBot.Message
): Promise<void> {
  try {
    const state = getUserState(userId);
    const messageText = msg.text || '';
    
    if (!state || state.state === FSM_STATES.IDLE) {
      // No active conversation
      return;
    }
    
    switch (state.state) {
      case FSM_STATES.WAITING_NAME:
        state.profile.name = messageText;
        setUserState(userId, {
          ...state,
          state: FSM_STATES.WAITING_VACATION_TYPE
        });
        
        // Present vacation type options from our configuration
        const { vacationTypes } = await import('../config/vacationTypes');
        
        const vacationTypeKeyboard = {
          inline_keyboard: vacationTypes.map(type => [
            { text: type.name, callback_data: `vacation_type_${type.key}` }
          ])
        };
        
        await bot.sendMessage(
          chatId,
          'Отлично! Выберите предпочтительный тип отдыха:',
          { reply_markup: vacationTypeKeyboard }
        );
        break;
        
      case FSM_STATES.WAITING_COUNTRIES:
        // Process countries
        let countries: string[] = [];
        if (messageText.toLowerCase() === 'открыт ко всему') {
          countries = ['Любая страна'];
        } else {
          countries = messageText.split(',').map(c => c.trim()).filter(c => c.length > 0);
        }
        
        state.profile.countries = countries;
        setUserState(userId, {
          ...state,
          state: FSM_STATES.WAITING_DESTINATION
        });
        
        await bot.sendMessage(
          chatId,
          'Хорошо! Теперь укажите конкретное направление (город или регион):'
        );
        break;
        
      case FSM_STATES.WAITING_DESTINATION:
        state.profile.destination = messageText;
        setUserState(userId, {
          ...state,
          state: FSM_STATES.WAITING_DATE_TYPE
        });
        
        await bot.sendMessage(
          chatId,
          'Выберите тип дат поездки:',
          {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: 'Точные даты', callback_data: 'date_type_fixed' },
                  { text: 'Гибкие даты', callback_data: 'date_type_flexible' }
                ]
              ]
            }
          }
        );
        break;
        
      case FSM_STATES.WAITING_FIXED_START_DATE:
        try {
          const startDate = new Date(messageText);
          
          if (isNaN(startDate.getTime())) {
            throw new Error('Invalid date');
          }
          
          state.profile.startDate = startDate;
          state.profile.dateType = 'fixed';
          
          setUserState(userId, {
            ...state,
            state: FSM_STATES.WAITING_FIXED_END_DATE
          });
          
          await bot.sendMessage(
            chatId,
            `Выбрана дата вылета: ${startDate.toLocaleDateString()}.\n\nТеперь укажите дату возвращения (в формате ГГГГ-ММ-ДД):`
          );
        } catch (err) {
          await bot.sendMessage(
            chatId,
            'Некорректный формат даты. Пожалуйста, используйте формат ГГГГ-ММ-ДД, например: 2024-06-15'
          );
        }
        break;
        
      case FSM_STATES.WAITING_FIXED_END_DATE:
        try {
          const endDate = new Date(messageText);
          
          if (isNaN(endDate.getTime())) {
            throw new Error('Invalid date');
          }
          
          if (state.profile.startDate && endDate <= state.profile.startDate) {
            await bot.sendMessage(
              chatId,
              'Дата возвращения должна быть позже даты вылета. Пожалуйста, укажите корректную дату:'
            );
            return;
          }
          
          state.profile.endDate = endDate;
          
          setUserState(userId, {
            ...state,
            state: FSM_STATES.WAITING_BUDGET
          });
          
          await bot.sendMessage(
            chatId,
            `Выбрана дата возвращения: ${endDate.toLocaleDateString()}.\n\nТеперь укажите ваш бюджет на человека (в рублях):`
          );
        } catch (err) {
          await bot.sendMessage(
            chatId,
            'Некорректный формат даты. Пожалуйста, используйте формат ГГГГ-ММ-ДД, например: 2024-06-22'
          );
        }
        break;
        
      case FSM_STATES.WAITING_FLEXIBLE_MONTH:
        state.profile.flexibleMonth = messageText;
        state.profile.dateType = 'flexible';
        
        setUserState(userId, {
          ...state,
          state: FSM_STATES.WAITING_TRIP_DURATION
        });
        
        await bot.sendMessage(
          chatId,
          `Выбран гибкий период: ${messageText}.\n\nТеперь укажите желаемую длительность поездки (количество дней):`
        );
        break;
        
      case FSM_STATES.WAITING_TRIP_DURATION:
        try {
          const duration = parseInt(messageText);
          
          if (isNaN(duration) || duration < 1) {
            throw new Error('Invalid duration');
          }
          
          state.profile.tripDuration = duration;
          
          setUserState(userId, {
            ...state,
            state: FSM_STATES.WAITING_BUDGET
          });
          
          await bot.sendMessage(
            chatId,
            `Длительность поездки: ${duration} дней.\n\nТеперь укажите ваш бюджет на человека (в рублях):`
          );
        } catch (err) {
          await bot.sendMessage(
            chatId,
            'Пожалуйста, укажите длительность поездки в виде числа дней (например: 7)'
          );
        }
        break;
        
      case FSM_STATES.WAITING_BUDGET:
        try {
          const budget = parseInt(messageText.replace(/\s+/g, '').replace(/[^\d]/g, ''));
          
          if (isNaN(budget) || budget < 1000) {
            throw new Error('Invalid budget');
          }
          
          state.profile.budget = budget;
          
          // Initialize priorities based on vacation type
          const { getVacationTypeByKey } = await import('../config/vacationTypes');
          const vacationType = state.profile.vacationType || 'beach'; // Default to beach if not set
          const vacationTypeConfig = getVacationTypeByKey(vacationType);
          
          // Set default priorities (medium priority for all criteria of this vacation type)
          if (vacationTypeConfig) {
            const defaultPriorities: Record<string, number> = {};
            vacationTypeConfig.criteria.forEach(criterion => {
              defaultPriorities[criterion.key] = 5; // Default medium priority
            });
            state.profile.priorities = defaultPriorities;
          } else {
            // Fallback if vacation type not found
            state.profile.priorities = {
              hotelStars: 5,
              beachLine: 5,
              allInclusive: 5,
              reviews: 5,
              renovation: 5,
              animation: 5
            };
          }
          
          setUserState(userId, {
            ...state,
            state: FSM_STATES.WAITING_DEADLINE
          });
          
          await bot.sendMessage(
            chatId,
            `Бюджет: ${budget.toLocaleString()} ₽.\n\nУкажите крайний срок ожидания (до какой даты мы ищем идеальные предложения, в формате ГГГГ-ММ-ДД):\n\nИли отправьте "нет", если срок не ограничен`
          );
        } catch (err) {
          await bot.sendMessage(
            chatId,
            'Пожалуйста, укажите бюджет в виде числа (например: 100000)'
          );
        }
        break;
        
      case FSM_STATES.WAITING_DEADLINE:
        try {
          let deadline = null;
          
          if (messageText.toLowerCase() !== 'нет') {
            deadline = new Date(messageText);
            
            if (isNaN(deadline.getTime())) {
              throw new Error('Invalid date');
            }
            
            // If date is valid but time is not set (it would be 00:00 local time), 
            // set it to end of day (23:59:59) to give full day for the deadline
            if (deadline.getHours() === 0 && deadline.getMinutes() === 0) {
              deadline.setHours(23, 59, 59, 999);
            }
          }
          
          state.profile.deadline = deadline;
          
          // Save profile to storage
          await storage.createOrUpdateProfile(state.profile);
          
          // Reset state
          resetUserState(userId);
          
          // Send confirmation
          const webAppUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}`;
          
          await bot.sendMessage(
            chatId,
            `Профиль успешно сохранен! Теперь мы можем подобрать для вас туры.\n\n${deadline ? `Мы будем искать подходящие предложения до ${deadline.toLocaleDateString()}.` : 'Мы будем искать подходящие предложения без ограничения по времени.'}`,
            {
              reply_markup: {
                inline_keyboard: [
                  [{ text: 'Открыть приложение', web_app: { url: webAppUrl } }]
                ]
              }
            }
          );
          
          // Set up notification for the deadline if specified
          if (deadline) {
            scheduleTourNotification(userId, deadline);
          }
        } catch (err) {
          await bot.sendMessage(
            chatId,
            'Некорректный формат даты. Пожалуйста, используйте формат ГГГГ-ММ-ДД, например: 2024-06-30, или отправьте "нет" для отсутствия срока'
          );
        }
        break;
        
      default:
        await bot.sendMessage(
          chatId,
          'Извините, я не понимаю этот запрос. Используйте /start, чтобы начать заново.'
        );
    }
  } catch (error) {
    console.error('Error handling message:', error);
    await bot.sendMessage(
      chatId,
      'Произошла ошибка при обработке сообщения. Пожалуйста, попробуйте еще раз или используйте /start, чтобы начать заново.'
    );
  }
}

export async function handleCallbackQuery(
  bot: TelegramBot, 
  chatId: number, 
  userId: string, 
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  try {
    const data = callbackQuery.data;
    
    if (!data) {
      return;
    }
    
    // Acknowledge callback query
    await bot.answerCallbackQuery(callbackQuery.id);
    
    if (data === 'start_profile') {
      // Start profile creation
      setUserState(userId, {
        state: FSM_STATES.WAITING_NAME,
        profile: {
          userId
        }
      });
      
      await bot.sendMessage(
        chatId,
        'Отлично! Давайте заполним вашу анкету. Как вас зовут?'
      );
    } else if (data.startsWith('vacation_type_')) {
      // Handle vacation type selection
      const state = getUserState(userId);
      const vacationType = data.replace('vacation_type_', '');
      
      if (state) {
        setUserState(userId, {
          ...state,
          state: FSM_STATES.WAITING_COUNTRIES,
          profile: {
            ...state.profile,
            vacationType
          }
        });
        
        await bot.sendMessage(
          chatId,
          'Отлично! Теперь укажите страны, которые вас интересуют (через запятую), или напишите "открыт ко всему":'
        );
      }
    } else if (data === 'edit_profile') {
      // Load existing profile
      const profile = await storage.getProfile(userId);
      
      if (!profile) {
        await bot.sendMessage(
          chatId,
          'Профиль не найден. Давайте создадим новый.'
        );
        
        setUserState(userId, {
          state: FSM_STATES.WAITING_NAME,
          profile: {
            userId
          }
        });
        
        await bot.sendMessage(
          chatId,
          'Как вас зовут?'
        );
        return;
      }
      
      setUserState(userId, {
        state: FSM_STATES.WAITING_NAME,
        profile: { ...profile }
      });
      
      await bot.sendMessage(
        chatId,
        `Давайте обновим вашу анкету. Текущее имя: ${profile.name}. Введите новое имя или отправьте то же самое, чтобы оставить без изменений:`
      );
    } else if (data === 'show_tours') {
      // Load profile
      const profile = await storage.getProfile(userId);
      
      if (!profile) {
        await bot.sendMessage(
          chatId,
          'Сначала необходимо заполнить анкету. Используйте /start.'
        );
        return;
      }
      
      await bot.sendMessage(
        chatId,
        'Подбираем для вас туры, это может занять некоторое время...'
      );
      
      // Get tours
      const tours = await getAllTours({
        userId,
        destination: profile.destination,
        startDate: profile.startDate,
        endDate: profile.endDate,
        dateType: profile.dateType,
        flexibleMonth: profile.flexibleMonth,
        tripDuration: profile.tripDuration,
        budget: profile.budget,
        priorities: profile.priorities
      });
      
      if (!tours || tours.length === 0) {
        await bot.sendMessage(
          chatId,
          'К сожалению, не удалось найти подходящие туры по вашим параметрам. Попробуйте изменить критерии поиска или воспользуйтесь функцией поиска попутчиков.',
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Изменить критерии', callback_data: 'edit_profile' }],
                [{ text: 'Найти попутчика', web_app: { url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/travel-buddy` } }]
              ]
            }
          }
        );
        return;
      }
      
      // Send top 3 tours
      const topTours = tours.slice(0, 3);
      
      for (const tour of topTours) {
        let message = `🏨 *${tour.title}*\n`;
        message += `📍 ${tour.destination}\n`;
        message += `⭐ ${tour.hotelStars} звезд\n`;
        message += `🗓 ${new Date(tour.startDate).toLocaleDateString()} - ${new Date(tour.endDate).toLocaleDateString()} (${tour.nights} ночей)\n`;
        message += `🍽 ${tour.mealType}\n`;
        message += `💰 *${tour.price.toLocaleString()} ₽*`;
        
        if (tour.priceOld && tour.priceOld > tour.price) {
          message += ` (скидка ${(tour.priceOld - tour.price).toLocaleString()} ₽)`;
        }
        
        message += `\n\n📊 Соответствие: ${tour.matchScore}%`;
        
        await bot.sendPhoto(chatId, tour.image, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: 'Подробнее', web_app: { url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/tours?tour=${tour.id}` } },
                { text: 'Бронировать', url: tour.link }
              ]
            ]
          }
        });
      }
      
      await bot.sendMessage(
        chatId,
        `Показаны ${topTours.length} из ${tours.length} найденных туров. Для просмотра всех туров и более удобной работы с ними используйте приложение:`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: 'Открыть все туры', web_app: { url: `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000'}/tours` } }]
            ]
          }
        }
      );
    } else if (data.startsWith('date_type_')) {
      const state = getUserState(userId);
      
      if (!state) {
        await bot.sendMessage(
          chatId,
          'Сессия истекла. Пожалуйста, начните заново с /start.'
        );
        return;
      }
      
      const dateType = data.substring(10); // Remove 'date_type_' prefix
      
      if (dateType === 'fixed') {
        setUserState(userId, {
          ...state,
          state: FSM_STATES.WAITING_FIXED_START_DATE
        });
        
        await bot.sendMessage(
          chatId,
          'Вы выбрали точные даты. Укажите дату вылета (в формате ГГГГ-ММ-ДД):'
        );
      } else if (dateType === 'flexible') {
        setUserState(userId, {
          ...state,
          state: FSM_STATES.WAITING_FLEXIBLE_MONTH
        });
        
        await bot.sendMessage(
          chatId,
          'Вы выбрали гибкие даты. Укажите предпочтительный месяц или период (например: "Июнь", "Лето 2024", "Следующий месяц"):'
        );
      }
    }
  } catch (error) {
    console.error('Error handling callback query:', error);
    await bot.sendMessage(
      chatId,
      'Произошла ошибка при обработке запроса. Пожалуйста, попробуйте еще раз или используйте /start, чтобы начать заново.'
    );
  }
}
