import TelegramBot from 'node-telegram-bot-api';
import { db } from '../../../db';
import { groupProfiles, profiles, tours, groupTourVotes } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { 
  createOrUpdateGroupProfile, 
  aggregateGroupProfiles,
  checkGroupMembersProfiles,
  handleGroupVote,
  sendVotingSummary
} from '../../services/groups';
import logger from '../../utils/logger';

/**
 * Обработчик команды /groupsetup с улучшенной идентификацией участников
 */
export async function handleGroupSetup(
  bot: TelegramBot,
  msg: TelegramBot.Message
): Promise<void> {
  const chatId = msg.chat.id;
  const userId = msg.from?.id.toString();
  const chatTitle = msg.chat.title || 'Группа';
  
  if (!userId) return;
  
  try {
    // Проверяем, что это групповой чат
    if (msg.chat.type === 'private') {
      await bot.sendMessage(
        chatId,
        '❌ Эта команда доступна только в групповых чатах.\n\nДобавьте бота в группу для совместного поиска туров.'
      );
      return;
    }
    
    // Проверяем права администратора
    const chatMember = await bot.getChatMember(chatId, parseInt(userId));
    const isAdmin = ['administrator', 'creator'].includes(chatMember.status);
    
    if (!isAdmin) {
      await bot.sendMessage(
        chatId,
        '❌ Только администраторы группы могут настраивать групповой поиск.'
      );
      return;
    }
    
    // Получаем количество участников чата
    const chatMembersCount = await bot.getChatMembersCount(chatId);
    
    // Создаем групповой профиль
    const groupId = await createOrUpdateGroupProfile(
      chatId.toString(),
      chatTitle,
      [] // Пока пустой массив участников
    );
    
    await bot.sendMessage(
      chatId,
      `✅ **Групповой поиск туров настроен!**\n\n` +
      `📍 Группа: ${chatTitle}\n` +
      `👥 Участников в чате: ${chatMembersCount}\n\n` +
      `**Как это работает:**\n` +
      `1️⃣ Каждый участник должен написать боту в личку и заполнить свои предпочтения\n` +
      `2️⃣ После заполнения анкеты вернуться сюда и нажать "Я готов к поиску"\n` +
      `3️⃣ Когда все будут готовы, мы найдем туры, которые устроят всех!\n\n` +
      `**Важно:** Бот учитывает только тех, кто заполнил анкету и подтвердил готовность.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{
              text: '📝 Заполнить анкету',
              url: `https://t.me/${(await bot.getMe()).username}?start=group_${chatId}`
            }],
            [{
              text: '✅ Я готов к поиску',
              callback_data: `group_ready_${groupId}`
            }],
            [{
              text: '👥 Кто готов?',
              callback_data: `group_status_${groupId}`
            }]
          ]
        }
      }
    );
  } catch (error) {
    logger.error('Error in group setup:', error);
    await bot.sendMessage(chatId, '❌ Произошла ошибка при настройке группового поиска.');
  }
}

/**
 * Обработчик готовности участника
 */
export async function handleGroupReady(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const userId = callbackQuery.from.id.toString();
  const userName = callbackQuery.from.first_name;
  const data = callbackQuery.data;
  
  if (!chatId || !data) return;
  
  try {
    const groupId = parseInt(data.split('_')[2]);
    
    // Проверяем, есть ли у пользователя профиль
    const [userProfile] = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    
    if (!userProfile) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Сначала заполните анкету в личном чате с ботом!',
        show_alert: true
      });
      return;
    }
    
    // Получаем групповой профиль
    const [group] = await db.select()
      .from(groupProfiles)
      .where(eq(groupProfiles.id, groupId))
      .limit(1);
    
    if (!group) return;
    
    const memberIds = (group.memberIds as string[]) || [];
    
    // Проверяем, не добавлен ли уже
    if (memberIds.includes(userId)) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Вы уже в списке участников! ✅'
      });
      return;
    }
    
    // Добавляем участника
    memberIds.push(userId);
    await db.update(groupProfiles)
      .set({
        memberIds,
        updatedAt: new Date()
      })
      .where(eq(groupProfiles.id, groupId));
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Вы добавлены в групповой поиск! ✅'
    });
    
    // Обновляем сообщение
    await bot.sendMessage(
      chatId,
      `✅ ${userName} готов к поиску!\n\n` +
      `Участников готово: ${memberIds.length}`,
      {
        reply_markup: {
          inline_keyboard: [
            [{
              text: '🔍 Начать поиск туров',
              callback_data: `group_search_${groupId}`
            }],
            [{
              text: '👥 Список участников',
              callback_data: `group_members_${groupId}`
            }]
          ]
        }
      }
    );
    
    // Обновляем агрегированный профиль
    await aggregateGroupProfiles(groupId);
    
  } catch (error) {
    logger.error('Error handling group ready:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Произошла ошибка',
      show_alert: true
    });
  }
}

/**
 * Показать статус группы
 */
export async function handleGroupStatus(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;
  
  if (!chatId || !data) return;
  
  try {
    const groupId = parseInt(data.split('_')[2]);
    
    // Получаем групповой профиль
    const [group] = await db.select()
      .from(groupProfiles)
      .where(eq(groupProfiles.id, groupId))
      .limit(1);
    
    if (!group) return;
    
    const memberIds = (group.memberIds as string[]) || [];
    
    if (memberIds.length === 0) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Пока никто не готов к поиску'
      });
      return;
    }
    
    // Получаем профили участников
    const memberProfiles = await db.select()
      .from(profiles)
      .where(inArray(profiles.userId, memberIds));
    
    let statusMessage = `📊 **Статус группового поиска**\n\n`;
    statusMessage += `✅ Готовы к поиску (${memberProfiles.length}):\n`;
    
    memberProfiles.forEach(profile => {
      statusMessage += `• ${profile.name || 'Участник'}\n`;
    });
    
    if (group.aggregatedProfile) {
      const aggProfile = group.aggregatedProfile as any;
      statusMessage += `\n📋 **Общие параметры:**\n`;
      
      if (aggProfile.countries?.length > 0) {
        statusMessage += `📍 Направления: ${aggProfile.countries.join(', ')}\n`;
      }
      if (aggProfile.budget) {
        statusMessage += `💰 Общий бюджет: ${aggProfile.budget.toLocaleString('ru-RU')} ₽\n`;
      }
      if (aggProfile.tripDuration) {
        statusMessage += `⏱ Длительность: ${aggProfile.tripDuration} ночей\n`;
      }
    }
    
    await bot.sendMessage(chatId, statusMessage, {
      parse_mode: 'Markdown',
      reply_markup: memberIds.length >= 2 ? {
        inline_keyboard: [[{
          text: '🔍 Начать поиск',
          callback_data: `group_search_${groupId}`
        }]]
      } : undefined
    });
    
    await bot.answerCallbackQuery(callbackQuery.id);
    
  } catch (error) {
    logger.error('Error showing group status:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Произошла ошибка'
    });
  }
}

/**
 * Групповой поиск туров
 */
export async function handleGroupSearch(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const data = callbackQuery.data;
  
  if (!chatId || !data) return;
  
  try {
    const groupId = parseInt(data.split('_')[2]);
    
    // Получаем групповой профиль
    const [group] = await db.select()
      .from(groupProfiles)
      .where(eq(groupProfiles.id, groupId))
      .limit(1);
    
    if (!group || !group.aggregatedProfile) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Сначала все участники должны заполнить анкеты',
        show_alert: true
      });
      return;
    }
    
    const memberIds = (group.memberIds as string[]) || [];
    
    if (memberIds.length < 2) {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Для группового поиска нужно минимум 2 участника',
        show_alert: true
      });
      return;
    }
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '🔍 Начинаю поиск...'
    });
    
    await bot.sendMessage(
      chatId,
      `🔎 Ищу туры для вашей группы из ${memberIds.length} человек...\n\n` +
      `Это может занять несколько секунд.`
    );
    
    // Здесь должен быть вызов поиска туров с агрегированными параметрами
    // const tours = await searchTours(group.aggregatedProfile);
    
    // Пока показываем заглушку
    await bot.sendMessage(
      chatId,
      `✅ Найдено 5 туров, подходящих для всех участников!\n\n` +
      `Каждый тур учитывает предпочтения всех ${memberIds.length} участников.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{
              text: '🏨 Тур 1: Турция, 5⭐',
              callback_data: `group_tour_1_${groupId}`
            }],
            [{
              text: '🏨 Тур 2: Египет, 4⭐',
              callback_data: `group_tour_2_${groupId}`
            }],
            [{
              text: '🏨 Тур 3: Греция, 4⭐',
              callback_data: `group_tour_3_${groupId}`
            }]
          ]
        }
      }
    );
    
  } catch (error) {
    logger.error('Error in group search:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Произошла ошибка при поиске'
    });
  }
}

/**
 * Голосование за тур
 */
export async function handleGroupTourVote(
  bot: TelegramBot,
  callbackQuery: TelegramBot.CallbackQuery
): Promise<void> {
  const chatId = callbackQuery.message?.chat.id;
  const userId = callbackQuery.from.id.toString();
  const userName = callbackQuery.from.first_name;
  const data = callbackQuery.data;
  
  if (!chatId || !data) return;
  
  try {
    // Парсим данные: group_vote_yes_tourId_groupId
    const parts = data.split('_');
    const vote = parts[2] as 'yes' | 'no' | 'maybe';
    const tourId = parseInt(parts[3]);
    const groupId = parseInt(parts[4]);
    
    // Записываем голос
    const voteCount = await handleGroupVote(groupId, tourId, userId, vote);
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: `Ваш голос "${vote === 'yes' ? '✅' : vote === 'no' ? '❌' : '🤔'}" учтен!`
    });
    
    // Отправляем обновление
    await bot.sendMessage(
      chatId,
      `${userName} проголосовал!\n\n` +
      `Текущие результаты:\n` +
      `✅ За: ${voteCount.yes}\n` +
      `❌ Против: ${voteCount.no}\n` +
      `🤔 Не уверен: ${voteCount.maybe}`
    );
    
    // Если все проголосовали, показываем итоги
    const [group] = await db.select()
      .from(groupProfiles)
      .where(eq(groupProfiles.id, groupId))
      .limit(1);
    
    const totalVotes = voteCount.yes + voteCount.no + voteCount.maybe;
    const totalMembers = (group?.memberIds as string[])?.length || 0;
    
    if (totalVotes >= totalMembers && totalMembers > 0) {
      await sendVotingSummary(bot, chatId.toString(), groupId, tourId);
    }
    
  } catch (error) {
    logger.error('Error handling vote:', error);
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Ошибка при голосовании'
    });
  }
}

/**
 * Показать карточку тура для группы
 */
export async function showGroupTourCard(
  bot: TelegramBot,
  chatId: number,
  tour: any,
  groupId: number
): Promise<void> {
  const tourMessage = `
🏨 **${tour.hotel}** ${tour.hotelStars}⭐
📍 ${tour.destination}
💰 ${tour.price.toLocaleString('ru-RU')} ₽ на всех
📅 ${tour.nights} ночей
🍽 ${tour.mealType}

${tour.description || ''}

_Голосуйте, подходит ли этот вариант для всех:_
`;

  await bot.sendMessage(chatId, tourMessage, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Подходит', callback_data: `group_vote_yes_${tour.id}_${groupId}` },
          { text: '❌ Не подходит', callback_data: `group_vote_no_${tour.id}_${groupId}` },
          { text: '🤔 Не уверен', callback_data: `group_vote_maybe_${tour.id}_${groupId}` }
        ],
        [
          { text: '🔗 Подробнее', url: tour.link }
        ]
      ]
    }
  });
}