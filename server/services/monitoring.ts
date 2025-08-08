import { db } from '../../db';
import { profiles, tours, tourMatches, monitoringTasks, groupProfiles } from '@shared/schema';
import { eq, and, or, gte, lte } from 'drizzle-orm';
import { searchTours } from '../providers';
import { calculateTourMatchScore } from './openrouter';
import { getBot } from '../bot';
import TelegramBot from 'node-telegram-bot-api';
import logger from '../utils/logger';
import { onShutdown } from '../utils/shutdown';

// Минимальный порог соответствия для отправки уведомления
const NOTIFICATION_THRESHOLD = 85;

export async function startMonitoring() {
  logger.info('Starting tour monitoring service...');
  try {
    await processPendingTasks();
    logger.info('Monitoring cycle processed');
  } catch (error) {
    logger.error('Error starting monitoring service:', error);
  }
  onShutdown('monitoring-service', async () => {
    logger.info('Stopping monitoring service...');
  });
}

async function processPendingTasks() {
  const now = new Date();
  const tasks = await db.select()
    .from(monitoringTasks)
    .where(
      and(
        eq(monitoringTasks.status, 'active' as any),
        lte(monitoringTasks.nextRunAt, now)
      )
    );

  logger.info(`Processing ${tasks.length} monitoring tasks`);

  for (const task of tasks) {
    try {
      switch (task.taskType) {
        case 'profile_monitor':
          if (task.userId && task.profileId) {
            await monitorProfileTours(task.userId, task.profileId);
          }
          break;
        case 'deadline_check':
          if (task.userId && task.profileId) {
            await checkDeadline(task.userId, task.profileId);
          }
          break;
        case 'group_monitor':
          if (task.groupId) {
            await monitorGroupTours(task.groupId);
          }
          break;
      }

      await db.update(monitoringTasks)
        .set({
          lastRunAt: now,
          nextRunAt: new Date(now.getTime() + 60 * 60 * 1000)
        })
        .where(eq(monitoringTasks.id, task.id));
    } catch (error) {
      logger.error(`Error processing task ${task.id}:`, error);
    }
  }
}

export async function monitorProfileTours(userId: string, profileId: number) {
  const [profile] = await db.select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile) return;

  logger.info(`Monitoring tours for user ${profile.userId}`);

  const countries = (profile.countries as string[]) || [];
  const searchParams: any = {
    destination: countries[0] || 'Любая',
    countries,
    budget: profile.budget || undefined,
    startDate: profile.startDate ? new Date(profile.startDate as any) : undefined,
    endDate: profile.endDate ? new Date(profile.endDate as any) : undefined,
    duration: profile.tripDuration || undefined,
    peopleCount: (profile as any).peopleCount || 2,
  };

  const foundTours = await searchTours(searchParams);

  for (const tourData of foundTours) {
    const { score, details, analysis } = await calculateTourMatchScore(
      tourData,
      {
        countries,
        budget: searchParams.budget,
        startDate: searchParams.startDate,
        endDate: searchParams.endDate,
        duration: searchParams.duration,
        peopleCount: searchParams.peopleCount,
      } as any,
      (profile.priorities as Record<string, number>) || {}
    );

    const extId = ((tourData as any).externalId || (tourData as any).id || '').toString();
    let [existingTour] = await db.select()
      .from(tours)
      .where(
        and(
          eq(tours.provider, tourData.provider),
          eq(tours.externalId, extId)
        )
      )
      .limit(1);

    if (!existingTour) {
      [existingTour] = await db.insert(tours)
        .values({
          providerId: tourData.provider,
          provider: tourData.provider,
          externalId: extId,
          title: tourData.title,
          country: (tourData as any).country || undefined,
          resort: (tourData as any).resort || undefined,
          hotelName: (tourData as any).hotel || undefined,
          starRating: (tourData as any).hotelStars || undefined,
          beachLine: (tourData as any).beachLine || undefined,
          mealType: (tourData as any).mealType || undefined,
          price: tourData.price,
          departureDate: (tourData as any).startDate || undefined,
          returnDate: (tourData as any).endDate || undefined,
          duration: (tourData as any).nights || undefined,
          hotelRating: (tourData as any).rating || undefined,
          photoUrl: (tourData as any).image || undefined,
          detailsUrl: (tourData as any).detailsUrl || (tourData as any).link || undefined,
          bookingUrl: (tourData as any).link || undefined,
          matchScore: score,
          aiAnalysis: analysis
        })
        .returning();
    }

    const [existingMatch] = await db.select()
      .from(tourMatches)
      .where(
        and(
          eq(tourMatches.tourId, existingTour.id),
          eq(tourMatches.profileId, profile.id)
        )
      )
      .limit(1);

    if (!existingMatch && score >= NOTIFICATION_THRESHOLD) {
      await db.insert(tourMatches)
        .values({
          tourId: existingTour.id,
          userId: profile.userId,
          profileId: profile.id,
          matchScore: score,
          matchDetails: details
        });

      await sendTourNotification(profile.userId, existingTour, score, analysis);
    }
  }
}

export async function checkDeadline(userId: string, profileId: number) {
  const [profile] = await db.select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile || !(profile as any).deadline) return;

  const now = new Date();
  const deadline = new Date((profile as any).deadline as any);
  if (now > deadline) {
    logger.info(`Deadline reached for user ${profile.userId}, suggesting alternatives`);

    const priorities = (profile.priorities as Record<string, number>) || {};
    const sortedPriorities = Object.entries(priorities).sort(([, a], [, b]) => a - b);

    const alternatives: any[] = [];

    if (profile.budget) {
      alternatives.push({
        ...profile,
        budget: Math.round(profile.budget * 1.2),
        alternativeType: 'increased_budget'
      });
    }

    if (profile.startDate && profile.endDate) {
      const start = new Date(profile.startDate as any).getTime();
      const end = new Date(profile.endDate as any).getTime();
      alternatives.push({
        ...profile,
        startDate: new Date(start - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(end + 7 * 24 * 60 * 60 * 1000),
        alternativeType: 'flexible_dates'
      });
    }

    const alternativeCountries = ['Турция', 'Египет', 'ОАЭ', 'Таиланд'];
    const currentCountries = (profile.countries as string[]) || [];
    const newCountries = alternativeCountries.filter(c => !currentCountries.includes(c));
    if (newCountries.length > 0) {
      alternatives.push({
        ...profile,
        countries: [...currentCountries, ...newCountries.slice(0, 2)],
        alternativeType: 'more_countries'
      });
    }

    await sendDeadlineNotification(profile.userId, alternatives);

    await db.update(monitoringTasks)
      .set({ status: 'completed' })
      .where(
        and(
          eq(monitoringTasks.profileId, profile.id),
          eq(monitoringTasks.taskType, 'deadline_check' as any)
        )
      );
  }
}

export async function monitorGroupTours(groupId: number) {
  const [group] = await db.select()
    .from(groupProfiles)
    .where(eq(groupProfiles.id, groupId))
    .limit(1);

  if (!group || !group.isActive) return;

  const aggregatedProfile = group.aggregatedProfile as any;
  if (!aggregatedProfile) return;

  logger.info(`Monitoring tours for group ${group.chatId}`);

  const countries = aggregatedProfile.countries || [];
  const searchParams: any = {
    destination: countries[0] || 'Любая',
    countries,
    budget: aggregatedProfile.budget,
    startDate: aggregatedProfile.startDate ? new Date(aggregatedProfile.startDate) : undefined,
    endDate: aggregatedProfile.endDate ? new Date(aggregatedProfile.endDate) : undefined,
    duration: aggregatedProfile.tripDuration,
    peopleCount: (group.memberIds as string[]).length * 2
  };

  const foundTours = await searchTours(searchParams);

  const topTours: Array<{ tourData: any; score: number; analysis: string }> = [];
  for (const tourData of foundTours) {
    const { score, details, analysis } = await calculateTourMatchScore(
      tourData,
      {
        countries,
        budget: searchParams.budget,
        startDate: searchParams.startDate,
        endDate: searchParams.endDate,
        duration: searchParams.duration,
        peopleCount: searchParams.peopleCount,
      } as any,
      (group.aggregatedPriorities as Record<string, number>) || {}
    );

    if (score >= NOTIFICATION_THRESHOLD - 10) {
      topTours.push({ tourData, score, analysis });
    }
  }

  topTours.sort((a, b) => b.score - a.score);

  if (topTours.length > 0) {
    await sendGroupTourOptions(group.chatId, topTours.slice(0, 3));
  }
}

async function sendTourNotification(userId: string, tour: any, score: number, analysis: string) {
  const bot = getBot();
  const message = `🎯 Найден отличный тур для вас!\n\n` +
    `${tour.title}\n` +
    `⭐ ${tour.starRating || ''} звезд${tour.beachLine ? `, ${tour.beachLine} линия` : ''}\n` +
    `🍽 ${tour.mealType || ''}\n` +
    `💰 ${tour.price.toLocaleString('ru-RU')} ₽\n` +
    `📅 ${tour.departureDate ? new Date(tour.departureDate).toLocaleDateString('ru-RU') : 'Гибкие даты'}\n` +
    `✈️ ${tour.duration || ''} ночей\n\n` +
    `📊 Соответствие вашим критериям: ${score}%\n` +
    `💡 ${analysis}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '👀 Подробнее', url: tour.detailsUrl },
        { text: '✅ Забронировать', url: tour.bookingUrl }
      ],
      [
        { text: '❌ Не интересно', callback_data: `reject_tour_${tour.id}` }
      ]
    ]
  };

  try {
    await (bot as any).sendPhoto(userId as any, tour.photoUrl || 'https://via.placeholder.com/400x300', {
      caption: message,
      reply_markup: keyboard
    });
  } catch (error) {
    await (bot as any).sendMessage(userId as any, message, { reply_markup: keyboard });
  }
}

async function sendDeadlineNotification(userId: string, alternatives: any[]) {
  const bot = getBot();
  let message = `⏰ Достигнут дедлайн поиска туров!\n\n` +
    `К сожалению, не удалось найти туры, полностью соответствующие вашим критериям. ` +
    `Вот несколько альтернативных вариантов:\n\n`;

  const buttons: any[] = [];

  for (const alt of alternatives) {
    switch (alt.alternativeType) {
      case 'increased_budget':
        message += `💰 Увеличить бюджет до ${alt.budget.toLocaleString('ru-RU')} ₽\n`;
        buttons.push({ text: '💰 Увеличить бюджет', callback_data: 'alt_budget' });
        break;
      case 'flexible_dates':
        message += `📅 Расширить даты поездки (±7 дней)\n`;
        buttons.push({ text: '📅 Гибкие даты', callback_data: 'alt_dates' });
        break;
      case 'more_countries':
        message += `🌍 Рассмотреть другие страны: ${alt.countries.join(', ')}\n`;
        buttons.push({ text: '🌍 Больше стран', callback_data: 'alt_countries' });
        break;
    }
  }

  message += `\nВыберите подходящий вариант или настройте новые параметры поиска.`;

  const keyboard = {
    inline_keyboard: [
      buttons,
      [{ text: '🔄 Новый поиск', callback_data: 'new_search' }]
    ]
  } as any;

  await (bot as any).sendMessage(userId as any, message, { reply_markup: keyboard });
}

async function sendGroupTourOptions(chatId: string, tours: any[]) {
  const bot = getBot();
  const message = `🗳 Найдены туры для вашей группы! Голосуйте за понравившиеся варианты:\n\n`;

  for (let i = 0; i < tours.length; i++) {
    const { tourData, score } = tours[i];
    const tourMessage = `${i + 1}. ${tourData.title}\n` +
      `⭐ ${(tourData as any).hotelStars || ''} звезд, 💰 ${tourData.price.toLocaleString('ru-RU')} ₽\n` +
      `📊 Соответствие: ${score}%\n`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '👍', callback_data: `vote_yes_${tourData.id}` },
          { text: '👎', callback_data: `vote_no_${tourData.id}` },
          { text: '🤔', callback_data: `vote_maybe_${tourData.id}` }
        ],
        [
          { text: '🔗 Подробнее', url: (tourData as any).link }
        ]
      ]
    } as any;

    await (bot as any).sendMessage(chatId as any, tourMessage, { reply_markup: keyboard });
  }
}