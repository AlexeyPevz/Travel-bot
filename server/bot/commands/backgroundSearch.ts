import TelegramBot from 'node-telegram-bot-api';
import { 
  createBackgroundSearch, 
  getUserBackgroundSearches,
  pauseBackgroundSearch,
  resumeBackgroundSearch,
  stopBackgroundSearch
} from '../../services/background-search';
import { NotifyConditions } from '@shared/schema-v2';
import logger from '../../utils/logger';
import { setUserState, getUserState } from '../fsm';

/**
 * Предлагает включить фоновый поиск после выполнения обычного поиска
 */
export async function offerBackgroundSearch(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  searchRequestId: number
) {
  const message = `🔔 **Хотите получать уведомления о новых подходящих турах?**

Я буду проверять новые предложения и сообщать вам о:
• 🆕 Новых турах по вашим параметрам
• 💰 Снижении цен на понравившиеся отели
• ✅ Появлении мест в популярных отелях

_Фоновый поиск работает автоматически и не требует вашего участия._`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Включить уведомления', callback_data: `enable_bg_search_${searchRequestId}` }
        ],
        [
          { text: '❌ Нет, спасибо', callback_data: 'skip_bg_search' }
        ]
      ]
    }
  });
}

/**
 * Обработка включения фонового поиска
 */
export async function handleEnableBackgroundSearch(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  searchRequestId: number
) {
  // Устанавливаем состояние для настройки фонового поиска
  setUserState(userId, {
    state: 'BG_SEARCH_SETUP' as any,
    backgroundSearchSetup: {
      searchRequestId,
      step: 'duration'
    }
  });

  await bot.sendMessage(
    chatId,
    `📅 До какой даты следить за турами?\n\n_Выберите период или укажите конкретную дату_`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '1 неделя', callback_data: 'bg_duration_7' },
            { text: '2 недели', callback_data: 'bg_duration_14' },
            { text: '1 месяц', callback_data: 'bg_duration_30' }
          ],
          [
            { text: '2 месяца', callback_data: 'bg_duration_60' },
            { text: '3 месяца', callback_data: 'bg_duration_90' }
          ],
          [
            { text: '❌ Отмена', callback_data: 'cancel_bg_setup' }
          ]
        ]
      }
    }
  );
}

/**
 * Обработка выбора длительности мониторинга
 */
export async function handleBackgroundSearchDuration(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  days: number
) {
  const state = getUserState(userId);
  if (!state?.backgroundSearchSetup) return;

  // Сохраняем длительность
  state.backgroundSearchSetup.monitorDays = days;
  state.backgroundSearchSetup.step = 'conditions';
  setUserState(userId, state);

  const message = `⚙️ **Настройка уведомлений**

Выберите, о чем вас уведомлять:`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🆕 Новые туры', callback_data: 'bg_cond_new' },
          { text: '💰 Снижение цен', callback_data: 'bg_cond_price' }
        ],
        [
          { text: '⭐ Только лучшие (топ-3)', callback_data: 'bg_cond_top' },
          { text: '🌙 Тихие часы', callback_data: 'bg_cond_quiet' }
        ],
        [
          { text: '✅ Готово', callback_data: 'bg_cond_done' }
        ],
        [
          { text: '❌ Отмена', callback_data: 'cancel_bg_setup' }
        ]
      ]
    }
  });
}

/**
 * Обработка настройки условий уведомлений
 */
export async function handleBackgroundSearchCondition(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  condition: string
) {
  const state = getUserState(userId);
  if (!state?.backgroundSearchSetup) return;

  // Инициализируем условия если их нет
  if (!state.backgroundSearchSetup.conditions) {
    state.backgroundSearchSetup.conditions = {
      notifyNewTours: true,
      priceDropPercent: 10,
      minMatchScore: 70
    };
  }

  let updateMessage = '';

  switch (condition) {
    case 'new':
      state.backgroundSearchSetup.conditions.notifyNewTours = 
        !state.backgroundSearchSetup.conditions.notifyNewTours;
      updateMessage = state.backgroundSearchSetup.conditions.notifyNewTours 
        ? '✅ Буду уведомлять о новых турах' 
        : '❌ Не буду уведомлять о новых турах';
      break;

    case 'price':
      // Запрашиваем процент снижения
      state.backgroundSearchSetup.step = 'price_drop';
      setUserState(userId, state);
      
      await bot.sendMessage(
        chatId,
        '💰 При каком снижении цены уведомлять?',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '5%', callback_data: 'bg_price_5' },
                { text: '10%', callback_data: 'bg_price_10' },
                { text: '15%', callback_data: 'bg_price_15' }
              ],
              [
                { text: '20%', callback_data: 'bg_price_20' },
                { text: 'Любое', callback_data: 'bg_price_1' }
              ],
              [
                { text: '⬅️ Назад', callback_data: 'bg_cond_back' }
              ]
            ]
          }
        }
      );
      return;

    case 'top':
      state.backgroundSearchSetup.conditions.onlyTopMatches = 
        !state.backgroundSearchSetup.conditions.onlyTopMatches;
      updateMessage = state.backgroundSearchSetup.conditions.onlyTopMatches 
        ? '⭐ Буду показывать только топ-3 варианта' 
        : '📋 Буду показывать все подходящие варианты';
      break;

    case 'quiet':
      // Запрашиваем тихие часы
      state.backgroundSearchSetup.step = 'quiet_hours';
      setUserState(userId, state);
      
      await bot.sendMessage(
        chatId,
        '🌙 В какое время не беспокоить?',
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '22:00 - 09:00', callback_data: 'bg_quiet_22_9' },
                { text: '23:00 - 08:00', callback_data: 'bg_quiet_23_8' }
              ],
              [
                { text: '00:00 - 07:00', callback_data: 'bg_quiet_0_7' },
                { text: 'Не нужно', callback_data: 'bg_quiet_none' }
              ],
              [
                { text: '⬅️ Назад', callback_data: 'bg_cond_back' }
              ]
            ]
          }
        }
      );
      return;

    case 'done':
      // Создаем фоновый поиск
      await createBackgroundSearchFromState(bot, chatId, userId);
      return;
  }

  // Обновляем состояние
  setUserState(userId, state);

  // Показываем обновление
  if (updateMessage) {
    await bot.answerCallbackQuery(state.callbackQueryId, {
      text: updateMessage,
      show_alert: false
    });
  }
}

/**
 * Создает фоновый поиск из состояния
 */
async function createBackgroundSearchFromState(
  bot: TelegramBot,
  chatId: number,
  userId: string
) {
  try {
    const state = getUserState(userId);
    if (!state?.backgroundSearchSetup) return;

    const { searchRequestId, monitorDays, conditions } = state.backgroundSearchSetup;
    
    // Вычисляем дату окончания мониторинга
    const monitorUntil = new Date();
    monitorUntil.setDate(monitorUntil.getDate() + (monitorDays || 30));

    // Создаем фоновый поиск
    const backgroundSearchId = await createBackgroundSearch(
      searchRequestId,
      userId,
      monitorUntil,
      conditions as NotifyConditions
    );

    // Очищаем состояние
    setUserState(userId, { state: 'IDLE' as any });

    // Подтверждение
    const confirmMessage = `✅ **Фоновый поиск активирован!**

Я буду проверять новые туры ${getFrequencyText(conditions?.onlyTopMatches ? 'twice_daily' : 'daily')} до ${monitorUntil.toLocaleDateString('ru-RU')}.

Вы получите уведомление когда:
${conditions?.notifyNewTours ? '• 🆕 Появятся новые подходящие туры\n' : ''}${conditions?.priceDropPercent ? `• 💰 Цена снизится на ${conditions.priceDropPercent}% или больше\n` : ''}${conditions?.onlyTopMatches ? '• ⭐ Только о лучших вариантах (топ-3)\n' : ''}${conditions?.quietHours ? `• 🌙 Не буду беспокоить с ${conditions.quietHours.start} до ${conditions.quietHours.end}\n` : ''}

Управлять уведомлениями можно командой /notifications`;

    await bot.sendMessage(chatId, confirmMessage, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '📋 Мои уведомления', callback_data: 'my_notifications' }
        ]]
      }
    });

  } catch (error) {
    logger.error('Error creating background search:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка при создании фонового поиска. Попробуйте позже.');
  }
}

/**
 * Показывает список активных фоновых поисков
 */
export async function showUserNotifications(
  bot: TelegramBot,
  chatId: number,
  userId: string
) {
  try {
    const searches = await getUserBackgroundSearches(userId);

    if (searches.length === 0) {
      await bot.sendMessage(
        chatId,
        '📭 У вас нет активных фоновых поисков.\n\nВыполните поиск туров и включите уведомления о новых предложениях!',
        {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔍 Найти туры', callback_data: 'start_search' }
            ]]
          }
        }
      );
      return;
    }

    let message = `📋 **Ваши активные уведомления** (${searches.length})\n\n`;

    for (const { backgroundSearch, searchRequest } of searches) {
      const destination = searchRequest.destination?.join(', ') || 'Любое направление';
      const monitorUntil = new Date(backgroundSearch.monitorUntil);
      const isPaused = backgroundSearch.isPaused;
      
      message += `${isPaused ? '⏸' : '🔔'} **${destination}**\n`;
      message += `   До: ${monitorUntil.toLocaleDateString('ru-RU')}\n`;
      message += `   Проверок: ${backgroundSearch.checksCount}\n`;
      message += `   Уведомлений: ${backgroundSearch.notificationsCount}\n\n`;
    }

    const keyboard = searches.map(({ backgroundSearch }) => {
      const isPaused = backgroundSearch.isPaused;
      return [
        {
          text: isPaused ? '▶️ Возобновить' : '⏸ Приостановить',
          callback_data: isPaused 
            ? `bg_resume_${backgroundSearch.id}`
            : `bg_pause_${backgroundSearch.id}`
        },
        {
          text: '❌ Удалить',
          callback_data: `bg_stop_${backgroundSearch.id}`
        }
      ];
    });

    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    logger.error('Error showing notifications:', error);
    await bot.sendMessage(chatId, '❌ Не удалось загрузить список уведомлений');
  }
}

/**
 * Обработчики для управления фоновым поиском
 */
export async function handleBackgroundSearchControl(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  action: 'pause' | 'resume' | 'stop',
  backgroundSearchId: number
) {
  try {
    let message = '';

    switch (action) {
      case 'pause':
        await pauseBackgroundSearch(backgroundSearchId, userId);
        message = '⏸ Фоновый поиск приостановлен';
        break;
      
      case 'resume':
        await resumeBackgroundSearch(backgroundSearchId, userId);
        message = '▶️ Фоновый поиск возобновлен';
        break;
      
      case 'stop':
        await stopBackgroundSearch(backgroundSearchId, userId);
        message = '❌ Фоновый поиск остановлен';
        break;
    }

    await bot.answerCallbackQuery(getUserState(userId)?.callbackQueryId || '', {
      text: message,
      show_alert: false
    });

    // Обновляем список
    await showUserNotifications(bot, chatId, userId);

  } catch (error) {
    logger.error('Error controlling background search:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка. Попробуйте позже.');
  }
}

function getFrequencyText(frequency: string): string {
  const frequencies: Record<string, string> = {
    'hourly': 'каждый час',
    'twice_daily': 'два раза в день',
    'daily': 'ежедневно',
    'weekly': 'еженедельно'
  };
  return frequencies[frequency] || frequency;
}