import TelegramBot from 'node-telegram-bot-api';
import { getUserState, setUserState } from '../fsm';

/**
 * Содержание карточек онбординга
 * Каждый элемент массива будет отправлен как отдельное сообщение
 */
// Карточки используют HTML форматирование для большей совместимости с Telegram
export const ONBOARDING_CARDS = [
  '🧠 <b>AI-ассистент по турам</b>\nЯ помогаю найти идеальный отдых на основе ваших предпочтений',
  '🤖 <b>Анализ предпочтений</b>\nИзучаю ваши приоритеты и стиль отдыха для лучших рекомендаций',
  '🧳 <b>Сравнение в реальном времени</b>\nПроверяю предложения от разных туроператоров в режиме реального времени',
  '🎯 <b>Персонализированные рекомендации</b>\nПоказываю только лучшие туры с объяснением их соответствия вашим желаниям',
  '🔎 <b>Поиск попутчиков</b>\nПомогу найти попутчиков для совместного отдыха с похожими интересами',
  '💰 <b>Реферальная программа</b>\nПриглашайте друзей и получайте бонусы на будущие путешествия'
];

/**
 * Задержка между отправкой карточек для "живого" эффекта (в миллисекундах)
 * Уменьшена для более быстрого отображения онбординга
 */
export const CARD_DELAY = 300;

/**
 * Отправляет карточки-инструкции и кнопку заполнения анкеты
 * @param bot Экземпляр Telegram бота
 * @param chatId ID чата
 * @param userId ID пользователя
 * @param force Принудительно показать карточки, даже если пользователь уже видел онбординг
 */
export async function sendIntroCards(
  bot: TelegramBot, 
  chatId: number, 
  userId: string,
  force: boolean = false
): Promise<void> {
  // Проверяем, показывали ли уже приветствие пользователю
  const userState = getUserState(userId);
  if (!force && userState?.onboardingShown) {
    console.log(`Онбординг уже был показан пользователю ${userId}`);
    return;
  }

  // Отмечаем, что онбординг показан
  if (userState) {
    setUserState(userId, {
      ...userState,
      onboardingShown: true
    });
  }

  // Отправляем карточки с задержкой с поддержкой Markdown форматирования
  console.log(`Отправка ${ONBOARDING_CARDS.length} онбординг-карточек пользователю ${userId}`);
  
  for (const card of ONBOARDING_CARDS) {
    try {
      // Используем HTML форматирование вместо Markdown для большей совместимости
      const htmlCard = card
        .replace(/\*([^*]+)\*/g, '<b>$1</b>')  // *жирный* -> <b>жирный</b>
        .replace(/\_([^_]+)\_/g, '<i>$1</i>'); // _курсив_ -> <i>курсив</i>
      
      await bot.sendMessage(chatId, htmlCard, { parse_mode: 'HTML' });
      console.log(`Карточка успешно отправлена: ${htmlCard.substring(0, 20)}...`);
      
      // Добавляем небольшую задержку между сообщениями
      await new Promise(resolve => setTimeout(resolve, CARD_DELAY));
    } catch (error) {
      console.error('Ошибка при отправке карточки:', error);
      // В случае ошибки форматирования отправляем без форматирования
      await bot.sendMessage(chatId, card.replace(/[\*\_]/g, ''));
      await new Promise(resolve => setTimeout(resolve, CARD_DELAY));
    }
  }

  // Отправляем кнопку для заполнения анкеты
  const markup = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👉 Заполнить анкету', callback_data: 'start_profile' }]
      ]
    }
  };

  await bot.sendMessage(
    chatId, 
    'Готовы начать подбор идеального отдыха? Расскажите немного о своих предпочтениях!',
    markup
  );
}