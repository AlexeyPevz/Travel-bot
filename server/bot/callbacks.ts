import TelegramBot from 'node-telegram-bot-api';
import logger from '../utils/logger';
import { getUserState, setUserState, FSM_STATES } from './fsm';
import { handleGroupSetupCallback } from './commands/groupsetup';
import { handleJoinCallback } from './commands/join';

/**
 * Обработчик callback-запросов от инлайн кнопок
 */
export async function handleCallbackQuery(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  try {
    const chatId = callbackQuery.message?.chat.id;
    const userId = callbackQuery.from.id.toString();
    const data = callbackQuery.data;

    if (!chatId || !data) {
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ошибка обработки запроса' });
      return;
    }

    // Получаем текущее состояние пользователя
    const userState = getUserState(userId);

    // Обработка callback в зависимости от данных
    if (data.startsWith('group_setup_')) {
      await handleGroupSetupCallback(bot, callbackQuery);
    } else if (data.startsWith('join_group_')) {
      await handleJoinCallback(bot, callbackQuery);
    } else if (data === 'skip_onboarding') {
      // Пропуск онбординга
      await setUserState(userId, FSM_STATES.IDLE);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Онбординг пропущен' });
      await bot.sendMessage(
        chatId, 
        'Вы можете начать поиск туров, просто отправив мне сообщение с вашими пожеланиями!'
      );
    } else if (data === 'search_tours') {
      // Начать поиск туров
      await setUserState(userId, FSM_STATES.WAITING_FOR_TOUR_REQUEST);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Начинаем поиск' });
      await bot.sendMessage(
        chatId,
        '🔍 Опишите, какой тур вы ищете. Например:\n\n' +
        '• "Хочу в Турцию на неделю, все включено"\n' +
        '• "Ищу тур в Египет до 100 тысяч на двоих"\n' +
        '• "Семейный отдых с детьми у моря"'
      );
    } else if (data === 'my_profile') {
      // Показать профиль
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Открываю профиль' });
      // Здесь можно добавить отправку ссылки на веб-приложение с профилем
      await bot.sendMessage(
        chatId,
        'Ваш профиль доступен в веб-приложении. Используйте /start для открытия.'
      );
    } else {
      // Неизвестный callback
      logger.warn(`Unknown callback data: ${data}`);
      await bot.answerCallbackQuery(callbackQuery.id, { text: 'Неизвестная команда' });
    }

  } catch (error) {
    logger.error('Error handling callback query:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Произошла ошибка' });
  }
}