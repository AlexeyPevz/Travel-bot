import TelegramBot from 'node-telegram-bot-api';
import { getUserState, setUserState, FSM_STATES, TourSearchData } from '../fsm';
import { analyzeTourRequest } from '../../services/openrouter';
import { searchTours } from '../../providers';
import { db } from '../../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import logger from '../../utils/logger';

// Популярные города вылета
const POPULAR_DEPARTURE_CITIES = [
  'Москва', 'Санкт-Петербург', 'Екатеринбург', 'Новосибирск',
  'Казань', 'Нижний Новгород', 'Самара', 'Краснодар'
];

/**
 * Начать процесс поиска туров из текстового запроса
 */
export async function startTourSearchFlow(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string
): Promise<void> {
  try {
    await bot.sendMessage(chatId, '🔍 Анализирую ваш запрос...');
    
    // Анализируем текст с помощью AI
    const preferences = await analyzeTourRequest(text);
    
    // Сохраняем проанализированные данные
    const searchData: TourSearchData = {
      destination: preferences.countries?.[0], // Берем первую страну как основную
      countries: preferences.countries,
      budget: preferences.budget,
      dateType: preferences.dateType || 'flexible',
      startDate: preferences.startDate,
      endDate: preferences.endDate,
      flexibleMonth: preferences.flexibleMonth,
      tripDuration: preferences.tripDuration || 7,
      vacationType: preferences.vacationType,
      priorities: preferences.priorities
    };
    
    // Обновляем состояние пользователя
    setUserState(userId, {
      state: FSM_STATES.SEARCH_WAITING_DEPARTURE_CITY,
      profile: { userId },
      searchData
    });
    
    // Показываем, что мы поняли из запроса
    let understoodMessage = '✅ Вот что я понял из вашего запроса:\n\n';
    
    if (searchData.countries && searchData.countries.length > 0) {
      understoodMessage += `📍 **Направление**: ${searchData.countries.join(', ')}\n`;
    }
    
    if (searchData.budget) {
      understoodMessage += `💰 **Бюджет**: до ${searchData.budget.toLocaleString('ru-RU')} ₽\n`;
    }
    
    if (searchData.dateType === 'fixed' && searchData.startDate && searchData.endDate) {
      understoodMessage += `📅 **Даты**: ${formatDate(searchData.startDate)} - ${formatDate(searchData.endDate)}\n`;
    } else if (searchData.flexibleMonth) {
      understoodMessage += `📅 **Месяц**: ${searchData.flexibleMonth}\n`;
    }
    
    if (searchData.tripDuration) {
      understoodMessage += `⏱ **Продолжительность**: ${searchData.tripDuration} ночей\n`;
    }
    
    understoodMessage += '\nТеперь мне нужно уточнить несколько обязательных параметров для поиска.';
    
    await bot.sendMessage(chatId, understoodMessage, { parse_mode: 'Markdown' });
    
    // Запрашиваем город вылета
    await askDepartureCity(bot, chatId);
    
  } catch (error) {
    logger.error('Error starting tour search flow:', error);
    await bot.sendMessage(
      chatId,
      '❌ Произошла ошибка при анализе запроса. Попробуйте еще раз или воспользуйтесь командой /search для пошагового поиска.'
    );
  }
}

/**
 * Запросить город вылета
 */
async function askDepartureCity(bot: TelegramBot, chatId: number): Promise<void> {
  const keyboard = {
    reply_markup: {
      keyboard: POPULAR_DEPARTURE_CITIES.map(city => [{text: city}]),
      one_time_keyboard: true,
      resize_keyboard: true
    }
  };
  
  await bot.sendMessage(
    chatId,
    '🏙 Из какого города вы планируете вылет?\n\nВыберите из списка или введите свой город:',
    keyboard
  );
}

/**
 * Обработать выбор города вылета
 */
export async function handleDepartureCity(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  city: string
): Promise<void> {
  // Сохраняем город вылета
  const state = getUserState(userId);
  if (!state || !state.searchData) return;
  
  state.searchData.departureCity = city;
  state.state = FSM_STATES.SEARCH_WAITING_ADULTS_COUNT;
  setUserState(userId, state);
  
  // Запрашиваем количество взрослых
  await bot.sendMessage(
    chatId,
    '👥 Сколько взрослых путешественников (от 18 лет)?',
    {
      reply_markup: {
        keyboard: [
          [{text: '1'}, {text: '2'}, {text: '3'}],
          [{text: '4'}, {text: '5'}, {text: '6+'}]
        ],
        one_time_keyboard: true,
        resize_keyboard: true
      }
    }
  );
}

/**
 * Обработать количество взрослых
 */
export async function handleAdultsCount(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  count: string
): Promise<void> {
  const state = getUserState(userId);
  if (!state || !state.searchData) return;
  
  // Парсим количество
  let adultsCount = count === '6+' ? 6 : parseInt(count);
  if (isNaN(adultsCount) || adultsCount < 1) {
    await bot.sendMessage(chatId, '❌ Пожалуйста, введите корректное число взрослых (от 1)');
    return;
  }
  
  state.searchData.adultsCount = adultsCount;
  state.state = FSM_STATES.SEARCH_WAITING_CHILDREN_INFO;
  setUserState(userId, state);
  
  // Спрашиваем про детей
  await bot.sendMessage(
    chatId,
    '👶 Будут ли с вами дети (до 18 лет)?',
    {
      reply_markup: {
        inline_keyboard: [
          [
            {text: 'Нет детей', callback_data: 'search_no_children'},
            {text: 'Есть дети', callback_data: 'search_has_children'}
          ]
        ]
      }
    }
  );
}

/**
 * Обработать информацию о детях
 */
export async function handleChildrenInfo(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  hasChildren: boolean
): Promise<void> {
  const state = getUserState(userId);
  if (!state || !state.searchData) return;
  
  if (!hasChildren) {
    state.searchData.childrenCount = 0;
    state.searchData.childrenAges = [];
    state.state = FSM_STATES.SEARCH_CONFIRMING_PARAMS;
    setUserState(userId, state);
    
    // Показываем итоговые параметры
    await showSearchSummary(bot, chatId, userId);
  } else {
    // Запрашиваем количество детей
    await bot.sendMessage(
      chatId,
      '👶 Сколько детей будет с вами?',
      {
        reply_markup: {
          keyboard: [
            [{text: '1'}, {text: '2'}, {text: '3'}],
            [{text: '4'}, {text: '5'}]
          ],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      }
    );
  }
}

/**
 * Обработать количество детей
 */
export async function handleChildrenCount(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  count: string
): Promise<void> {
  const state = getUserState(userId);
  if (!state || !state.searchData) return;
  
  const childrenCount = parseInt(count);
  if (isNaN(childrenCount) || childrenCount < 1) {
    await bot.sendMessage(chatId, '❌ Пожалуйста, введите корректное число детей');
    return;
  }
  
  state.searchData.childrenCount = childrenCount;
  state.searchData.childrenAges = [];
  state.state = FSM_STATES.SEARCH_WAITING_CHILDREN_AGES;
  setUserState(userId, state);
  
  // Запрашиваем возраст детей
  await bot.sendMessage(
    chatId,
    `👶 Укажите возраст детей через запятую.\n\nНапример: 5, 10, 14\n\n_Возраст детей важен для правильного расчета стоимости_`,
    { parse_mode: 'Markdown' }
  );
}

/**
 * Обработать возраст детей
 */
export async function handleChildrenAges(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  agesText: string
): Promise<void> {
  const state = getUserState(userId);
  if (!state || !state.searchData) return;
  
  // Парсим возраста
  const ages = agesText.split(/[,\s]+/)
    .map(age => parseInt(age.trim()))
    .filter(age => !isNaN(age) && age >= 0 && age < 18);
  
  if (ages.length !== state.searchData.childrenCount) {
    await bot.sendMessage(
      chatId,
      `❌ Пожалуйста, укажите возраст для всех ${state.searchData.childrenCount} детей через запятую`
    );
    return;
  }
  
  state.searchData.childrenAges = ages;
  state.state = FSM_STATES.SEARCH_CONFIRMING_PARAMS;
  setUserState(userId, state);
  
  // Показываем итоговые параметры
  await showSearchSummary(bot, chatId, userId);
}

/**
 * Показать итоговые параметры поиска
 */
async function showSearchSummary(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const state = getUserState(userId);
  if (!state || !state.searchData) return;
  
  const data = state.searchData;
  
  let summary = '📋 **Параметры вашего поиска:**\n\n';
  
  // Направление
  if (data.countries && data.countries.length > 0) {
    summary += `📍 **Куда**: ${data.countries.join(', ')}\n`;
  }
  
  // Откуда
  summary += `✈️ **Откуда**: ${data.departureCity}\n`;
  
  // Даты
  if (data.dateType === 'fixed' && data.startDate && data.endDate) {
    summary += `📅 **Когда**: ${formatDate(data.startDate)} - ${formatDate(data.endDate)}\n`;
  } else if (data.flexibleMonth) {
    summary += `📅 **Месяц**: ${data.flexibleMonth} (гибкие даты)\n`;
  } else {
    summary += `📅 **Даты**: гибкие\n`;
  }
  
  // Продолжительность
  if (data.tripDuration) {
    summary += `⏱ **Ночей**: ${data.tripDuration}\n`;
  }
  
  // Путешественники
  summary += `👥 **Взрослых**: ${data.adultsCount}\n`;
  if (data.childrenCount && data.childrenCount > 0) {
    summary += `👶 **Детей**: ${data.childrenCount} (возраст: ${data.childrenAges?.join(', ')})\n`;
  }
  
  // Бюджет
  if (data.budget) {
    summary += `💰 **Бюджет**: до ${data.budget.toLocaleString('ru-RU')} ₽\n`;
  }
  
  summary += '\n✅ Все готово для поиска!';
  
  await bot.sendMessage(chatId, summary, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          {text: '🔍 Начать поиск', callback_data: 'search_confirm'},
          {text: '✏️ Изменить', callback_data: 'search_edit'}
        ],
        [
          {text: '❌ Отменить', callback_data: 'search_cancel'}
        ]
      ]
    }
  });
}

/**
 * Выполнить поиск туров
 */
export async function performTourSearch(
  bot: TelegramBot,
  chatId: number,
  userId: string
): Promise<void> {
  const state = getUserState(userId);
  if (!state || !state.searchData) return;
  
  const data = state.searchData;
  
  // Проверяем обязательные параметры
  if (!data.departureCity || !data.adultsCount || !data.countries || data.countries.length === 0) {
    await bot.sendMessage(chatId, '❌ Не хватает обязательных параметров для поиска');
    return;
  }
  
  try {
    await bot.sendMessage(chatId, '🔎 Ищу туры по вашим параметрам...\n\n_Это может занять несколько секунд_', {
      parse_mode: 'Markdown'
    });
    
    // Подготавливаем параметры для API
    const searchParams = {
      destination: data.countries[0], // Основная страна
      dateType: data.dateType || 'flexible',
      startDate: data.startDate,
      endDate: data.endDate,
      flexibleMonth: data.flexibleMonth,
      tripDuration: data.tripDuration || 7,
      budget: data.budget,
      priorities: data.priorities,
      // Дополнительные параметры для провайдеров
      departureCity: data.departureCity,
      adults: data.adultsCount,
      children: data.childrenCount || 0,
      childrenAges: data.childrenAges || []
    };
    
    // Выполняем поиск
    const tours = await searchTours(searchParams);
    
    if (tours.length === 0) {
      await bot.sendMessage(
        chatId,
        '😔 К сожалению, по вашим параметрам туров не найдено.\n\nПопробуйте:\n• Увеличить бюджет\n• Изменить даты\n• Выбрать другое направление',
        {
          reply_markup: {
            inline_keyboard: [
              [{text: '🔄 Изменить параметры', callback_data: 'search_edit'}],
              [{text: '🆕 Новый поиск', callback_data: 'new_search'}]
            ]
          }
        }
      );
      return;
    }
    
    // Показываем результаты
    await bot.sendMessage(
      chatId,
      `✅ Найдено ${tours.length} туров!\n\nПоказываю первые 5 вариантов:`
    );
    
    // Показываем первые 5 туров
    for (let i = 0; i < Math.min(5, tours.length); i++) {
      const tour = tours[i];
      await sendTourCard(bot, chatId, tour);
    }
    
    // Сохраняем результаты и сбрасываем состояние
    state.state = FSM_STATES.IDLE;
    setUserState(userId, state);
    
  } catch (error) {
    logger.error('Error performing tour search:', error);
    await bot.sendMessage(
      chatId,
      '❌ Произошла ошибка при поиске туров. Пожалуйста, попробуйте позже.'
    );
  }
}

/**
 * Отправить карточку тура
 */
async function sendTourCard(bot: TelegramBot, chatId: number, tour: any): Promise<void> {
  const message = `
🏨 **${tour.hotel}** ${tour.hotelStars}⭐
📍 ${tour.destination}
🌴 ${tour.beachLine || 'Линия пляжа не указана'}
🍽 ${tour.mealType || 'Тип питания не указан'}
📅 ${tour.nights} ночей
💰 **${tour.price.toLocaleString('ru-RU')} ₽**
${tour.priceOld ? `~~${tour.priceOld.toLocaleString('ru-RU')} ₽~~` : ''}

[Подробнее](${tour.link})
`;

  await bot.sendMessage(chatId, message, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{text: '🔗 Перейти к туру', url: tour.link}]
      ]
    }
  });
}

/**
 * Форматирование даты
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long'
  });
}