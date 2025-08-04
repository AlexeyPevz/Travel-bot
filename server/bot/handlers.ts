import TelegramBot from 'node-telegram-bot-api';
import { commandRegistry, CommandContext } from './commands';
import { handleFreeTextTourRequest, isTourSearchRequest } from './commands/text';
import { getUserState, setUserState, FSM_STATES } from './fsm';
import { handleCallbackQuery } from './callbacks';
import logger from '../utils/logger';

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
    
    // Если пользователь в процессе заполнения анкеты
    if (userState && userState.state !== FSM_STATES.IDLE) {
      // Обрабатываем через FSM (эта логика остается в отдельном модуле)
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
  const chatId = callbackQuery.message?.chat.id;
  const userId = callbackQuery.from.id.toString();
  const data = callbackQuery.data;
  
  if (!chatId || !data) {
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Ошибка обработки запроса' });
    return;
  }
  
  try {
    // Делегируем обработку в отдельный модуль
    await handleCallbackQuery(bot, callbackQuery);
  } catch (error) {
    logger.error('Error handling callback:', error);
    await bot.answerCallbackQuery(callbackQuery.id, { text: 'Произошла ошибка' });
  }
}

/**
 * Обработчик FSM состояний (заглушка - реальная логика в отдельном модуле)
 */
async function handleFSMInput(
  bot: TelegramBot,
  chatId: number,
  userId: string,
  text: string,
  userState: any
): Promise<void> {
  // TODO: Переместить FSM логику в отдельный модуль
  // Пока оставляем заглушку
  logger.warn('FSM handling not yet refactored');
  await bot.sendMessage(chatId, 'Обработка анкеты временно недоступна. Используйте веб-приложение.');
}

// Экспортируем все необходимые функции
export * from './callbacks';
export * from './fsm';
export * from './utils';
export * from './commands';
