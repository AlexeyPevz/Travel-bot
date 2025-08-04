import { db } from '../../db';
import { groupProfiles, profiles, groupTourVotes, tours, monitoringTasks } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import TelegramBot from 'node-telegram-bot-api';

/**
 * Создание или обновление группового профиля
 */
export async function createOrUpdateGroupProfile(
  chatId: string,
  chatTitle: string,
  memberIds: string[]
) {
  const [existingGroup] = await db.select()
    .from(groupProfiles)
    .where(eq(groupProfiles.chatId, chatId))
    .limit(1);

  if (existingGroup) {
    // Обновляем существующий профиль
    await db.update(groupProfiles)
      .set({
        chatTitle,
        memberIds,
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(groupProfiles.chatId, chatId));
    
    return existingGroup.id;
  } else {
    // Создаем новый профиль
    const [newGroup] = await db.insert(groupProfiles)
      .values({
        chatId,
        chatTitle,
        memberIds,
        isActive: true
      })
      .returning();
    
    return newGroup.id;
  }
}

/**
 * Агрегация профилей участников группы
 */
export async function aggregateGroupProfiles(groupId: number) {
  const [group] = await db.select()
    .from(groupProfiles)
    .where(eq(groupProfiles.id, groupId))
    .limit(1);

  if (!group) return;

  const memberIds = group.memberIds as string[];
  
  // Получаем профили всех участников
  const memberProfiles = await db.select()
    .from(profiles)
    .where(inArray(profiles.userId, memberIds));

  if (memberProfiles.length === 0) return;

  // Агрегируем параметры
  const aggregatedProfile: any = {
    countries: [],
    budget: 0,
    startDate: null,
    endDate: null,
    tripDuration: 0,
    vacationType: null
  };

  const aggregatedPriorities: Record<string, number> = {};
  const priorityKeys = [
    'starRating', 'beachLine', 'mealType', 'price',
    'hotelRating', 'location', 'familyFriendly'
  ];

  // Собираем все страны
  const allCountries = new Set<string>();
  memberProfiles.forEach(profile => {
    if (profile.countries) {
      (profile.countries as string[]).forEach(c => allCountries.add(c));
    }
  });
  aggregatedProfile.countries = Array.from(allCountries);

  // Средний бюджет
  const budgets = memberProfiles
    .filter(p => p.budget)
    .map(p => p.budget!);
  if (budgets.length > 0) {
    aggregatedProfile.budget = Math.round(
      budgets.reduce((a, b) => a + b, 0) / budgets.length
    ) * memberIds.length; // Умножаем на количество участников
  }

  // Пересечение дат
  const startDates = memberProfiles
    .filter(p => p.startDate)
    .map(p => p.startDate!.getTime());
  const endDates = memberProfiles
    .filter(p => p.endDate)
    .map(p => p.endDate!.getTime());

  if (startDates.length > 0) {
    aggregatedProfile.startDate = new Date(Math.max(...startDates));
  }
  if (endDates.length > 0) {
    aggregatedProfile.endDate = new Date(Math.min(...endDates));
  }

  // Средняя длительность
  const durations = memberProfiles
    .filter(p => p.tripDuration)
    .map(p => p.tripDuration!);
  if (durations.length > 0) {
    aggregatedProfile.tripDuration = Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length
    );
  }

  // Агрегация приоритетов (среднее значение)
  priorityKeys.forEach(key => {
    const values: number[] = [];
    memberProfiles.forEach(profile => {
      if (profile.priorities && (profile.priorities as any)[key]) {
        values.push((profile.priorities as any)[key]);
      }
    });
    if (values.length > 0) {
      aggregatedPriorities[key] = Math.round(
        values.reduce((a, b) => a + b, 0) / values.length
      );
    } else {
      aggregatedPriorities[key] = 5; // Значение по умолчанию
    }
  });

  // Сохраняем агрегированный профиль
  await db.update(groupProfiles)
    .set({
      aggregatedProfile,
      aggregatedPriorities,
      updatedAt: new Date()
    })
    .where(eq(groupProfiles.id, groupId));

  // Создаем задачу мониторинга для группы
  await db.insert(monitoringTasks)
    .values({
      groupId,
      taskType: 'group_monitor',
      nextRunAt: new Date(Date.now() + 30 * 60 * 1000), // Через 30 минут
      status: 'active'
    })
    .onConflictDoNothing();

  return { aggregatedProfile, aggregatedPriorities };
}

/**
 * Обработка голосования за тур
 */
export async function handleGroupVote(
  groupId: number,
  tourId: number,
  userId: string,
  vote: 'yes' | 'no' | 'maybe',
  comment?: string
) {
  // Проверяем, голосовал ли уже пользователь
  const [existingVote] = await db.select()
    .from(groupTourVotes)
    .where(
      and(
        eq(groupTourVotes.groupId, groupId),
        eq(groupTourVotes.tourId, tourId),
        eq(groupTourVotes.userId, userId)
      )
    )
    .limit(1);

  if (existingVote) {
    // Обновляем голос
    await db.update(groupTourVotes)
      .set({ vote, comment })
      .where(eq(groupTourVotes.id, existingVote.id));
  } else {
    // Создаем новый голос
    await db.insert(groupTourVotes)
      .values({
        groupId,
        tourId,
        userId,
        vote,
        comment
      });
  }

  // Подсчитываем голоса
  const votes = await db.select()
    .from(groupTourVotes)
    .where(
      and(
        eq(groupTourVotes.groupId, groupId),
        eq(groupTourVotes.tourId, tourId)
      )
    );

  const voteCount = {
    yes: votes.filter(v => v.vote === 'yes').length,
    no: votes.filter(v => v.vote === 'no').length,
    maybe: votes.filter(v => v.vote === 'maybe').length
  };

  return voteCount;
}

/**
 * Получение результатов голосования
 */
export async function getVoteResults(groupId: number, tourId: number) {
  const votes = await db.select()
    .from(groupTourVotes)
    .where(
      and(
        eq(groupTourVotes.groupId, groupId),
        eq(groupTourVotes.tourId, tourId)
      )
    );

  const [tour] = await db.select()
    .from(tours)
    .where(eq(tours.id, tourId))
    .limit(1);

  const [group] = await db.select()
    .from(groupProfiles)
    .where(eq(groupProfiles.id, groupId))
    .limit(1);

  const memberCount = (group?.memberIds as string[])?.length || 0;

  const results = {
    tour: tour?.title || 'Неизвестный тур',
    totalVotes: votes.length,
    totalMembers: memberCount,
    votes: {
      yes: votes.filter(v => v.vote === 'yes').length,
      no: votes.filter(v => v.vote === 'no').length,
      maybe: votes.filter(v => v.vote === 'maybe').length
    },
    percentage: {
      yes: memberCount > 0 ? Math.round((votes.filter(v => v.vote === 'yes').length / memberCount) * 100) : 0,
      no: memberCount > 0 ? Math.round((votes.filter(v => v.vote === 'no').length / memberCount) * 100) : 0,
      maybe: memberCount > 0 ? Math.round((votes.filter(v => v.vote === 'maybe').length / memberCount) * 100) : 0
    },
    comments: votes.filter(v => v.comment).map(v => ({
      userId: v.userId,
      vote: v.vote,
      comment: v.comment
    }))
  };

  return results;
}

/**
 * Отправка сводки голосования в группу
 */
export async function sendVotingSummary(bot: TelegramBot, chatId: string, groupId: number, tourId: number) {
  const results = await getVoteResults(groupId, tourId);
  
  let message = `📊 Результаты голосования за тур:\n${results.tour}\n\n`;
  message += `Всего проголосовало: ${results.totalVotes} из ${results.totalMembers}\n\n`;
  message += `✅ За: ${results.votes.yes} (${results.percentage.yes}%)\n`;
  message += `❌ Против: ${results.votes.no} (${results.percentage.no}%)\n`;
  message += `🤔 Не определились: ${results.votes.maybe} (${results.percentage.maybe}%)\n`;

  if (results.comments.length > 0) {
    message += `\n💬 Комментарии:\n`;
    results.comments.forEach(c => {
      const voteEmoji = c.vote === 'yes' ? '✅' : c.vote === 'no' ? '❌' : '🤔';
      message += `${voteEmoji} ${c.comment}\n`;
    });
  }

  // Рекомендация на основе голосов
  if (results.percentage.yes >= 70) {
    message += `\n✨ Рекомендация: Тур получил высокую поддержку! Рекомендуем забронировать.`;
  } else if (results.percentage.yes >= 50) {
    message += `\n💡 Рекомендация: Больше половины участников заинтересованы. Стоит обсудить детали.`;
  } else {
    message += `\n🔍 Рекомендация: Низкая заинтересованность. Рассмотрите другие варианты.`;
  }

  await bot.sendMessage(chatId, message);
}

/**
 * Проверка, все ли участники группы имеют профили
 */
export async function checkGroupMembersProfiles(memberIds: string[]) {
  const existingProfiles = await db.select()
    .from(profiles)
    .where(inArray(profiles.userId, memberIds));

  const existingUserIds = existingProfiles.map(p => p.userId);
  const missingUserIds = memberIds.filter(id => !existingUserIds.includes(id));

  return {
    complete: missingUserIds.length === 0,
    existingProfiles,
    missingUserIds
  };
}