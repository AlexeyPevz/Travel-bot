import { db } from '../../db';
import { profiles, tours, tourMatches, monitoringTasks, groupProfiles } from '@shared/schema';
import { eq, and, or, gte, lte } from 'drizzle-orm';
import { searchTours } from '../providers';
import { calculateTourMatchScore } from './openrouter';
import { getBot } from '../bot';
import TelegramBot from 'node-telegram-bot-api';
import logger from '../utils/logger';

// Минимальный порог соответствия для отправки уведомления
const NOTIFICATION_THRESHOLD = 85;

/**
 * Запуск фонового мониторинга
 */
export async function startMonitoring() {
  logger.info('Starting tour monitoring service...');
  
  // Загружаем активные задачи мониторинга из БД и добавляем в очереди
  try {
    const activeTasks = await db.select()
      .from(monitoringTasks)
      .where(eq(monitoringTasks.status, 'active'));
    
    logger.info(`Found ${activeTasks.length} active monitoring tasks`);
    
    // Импортируем динамически чтобы избежать циклической зависимости
    const { scheduleMonitoring } = await import('./queues');
    
    for (const task of activeTasks) {
      await scheduleMonitoring(
        task.userId,
        task.profileId,
        task.taskType as any,
        undefined,
        task.groupId || undefined
      );
    }
    
    logger.info('All monitoring tasks scheduled');
  } catch (error) {
    logger.error('Error starting monitoring service:', error);
  }
}

/**
 * Обработка ожидающих задач мониторинга
 */
async function processPendingTasks() {
  const now = new Date();
  
  // Получаем активные задачи, которые пора выполнить
  const tasks = await db.select()
    .from(monitoringTasks)
    .where(
      and(
        eq(monitoringTasks.status, 'active'),
        lte(monitoringTasks.nextRunAt, now)
      )
    );

  logger.info(`Processing ${tasks.length} monitoring tasks`);

  for (const task of tasks) {
    try {
      switch (task.taskType) {
        case 'profile_monitor':
          await monitorProfileTours(task);
          break;
        case 'deadline_check':
          await checkDeadline(task);
          break;
        case 'group_monitor':
          await monitorGroupTours(task);
          break;
      }

      // Обновляем время следующего запуска
      await db.update(monitoringTasks)
        .set({
          lastRunAt: now,
          nextRunAt: new Date(now.getTime() + 60 * 60 * 1000) // +1 час
        })
        .where(eq(monitoringTasks.id, task.id));
    } catch (error) {
      logger.error(`Error processing task ${task.id}:`, error);
    }
  }
}

/**
 * Мониторинг туров для профиля пользователя
 */
export async function monitorProfileTours(userId: string, profileId: number) {
  const [profile] = await db.select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile) return;

  logger.info(`Monitoring tours for user ${profile.userId}`);

  // Поиск туров по параметрам профиля
  const searchParams = {
    countries: profile.countries as string[],
    budget: profile.budget || undefined,
    startDate: profile.startDate || undefined,
    endDate: profile.endDate || undefined,
    duration: profile.tripDuration || undefined,
    peopleCount: profile.peopleCount || 2
  };

  const foundTours = await searchTours(searchParams);
  
  // Анализируем каждый тур
  for (const tourData of foundTours) {
    const { score, details, analysis } = await calculateTourMatchScore(
      tourData,
      searchParams,
      profile.priorities as Record<string, number> || {}
    );

    // Сохраняем тур в БД если еще нет
    let [existingTour] = await db.select()
      .from(tours)
      .where(
        and(
          eq(tours.provider, tourData.provider),
          eq(tours.externalId, tourData.id)
        )
      )
      .limit(1);

    if (!existingTour) {
      [existingTour] = await db.insert(tours)
        .values({
          provider: tourData.provider,
          providerId: tourData.provider,
          externalId: tourData.id,
          title: tourData.title,
          country: tourData.country,
          resort: tourData.resort,
          hotelName: tourData.hotelName,
          starRating: tourData.stars,
          beachLine: tourData.beachLine,
          mealType: tourData.mealType,
          price: tourData.price,
          departureDate: tourData.startDate,
          returnDate: tourData.endDate,
          duration: tourData.nights,
          hotelRating: tourData.rating,
          photoUrl: tourData.photoUrl,
          detailsUrl: tourData.link,
          bookingUrl: tourData.link,
          matchScore: score,
          aiAnalysis: analysis
        })
        .returning();
    }

    // Проверяем, уведомляли ли уже о этом туре
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
      // Сохраняем соответствие
      await db.insert(tourMatches)
        .values({
          tourId: existingTour.id,
          userId: profile.userId,
          profileId: profile.id,
          matchScore: score,
          matchDetails: details
        });

      // Отправляем уведомление
      await sendTourNotification(profile.userId, existingTour, score, analysis);
    }
  }
}

/**
 * Проверка дедлайнов и предложение альтернатив
 */
export async function checkDeadline(userId: string, profileId: number) {
  const [profile] = await db.select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  if (!profile || !profile.deadline) return;

  const now = new Date();
  if (now > profile.deadline) {
    logger.info(`Deadline reached for user ${profile.userId}, suggesting alternatives`);

    // Получаем приоритеты пользователя
    const priorities = profile.priorities as Record<string, number> || {};
    
    // Определяем, какие параметры можно ослабить в порядке важности
    const sortedPriorities = Object.entries(priorities)
      .sort(([, a], [, b]) => a - b); // Сортируем по возрастанию важности

    // Создаем альтернативные параметры поиска
    const alternatives = [];

    // 1. Увеличиваем бюджет на 20%
    if (profile.budget) {
      alternatives.push({
        ...profile,
        budget: Math.round(profile.budget * 1.2),
        alternativeType: 'increased_budget'
      });
    }

    // 2. Расширяем даты на ±7 дней
    if (profile.startDate && profile.endDate) {
      alternatives.push({
        ...profile,
        startDate: new Date(profile.startDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(profile.endDate.getTime() + 7 * 24 * 60 * 60 * 1000),
        alternativeType: 'flexible_dates'
      });
    }

    // 3. Добавляем альтернативные страны
    const alternativeCountries = ['Турция', 'Египет', 'ОАЭ', 'Таиланд'];
    const currentCountries = profile.countries as string[] || [];
    const newCountries = alternativeCountries.filter(c => !currentCountries.includes(c));
    
    if (newCountries.length > 0) {
      alternatives.push({
        ...profile,
        countries: [...currentCountries, ...newCountries.slice(0, 2)],
        alternativeType: 'more_countries'
      });
    }

    // Отправляем уведомление о дедлайне с альтернативами
    await sendDeadlineNotification(profile.userId, alternatives);

    // Деактивируем задачу
    await db.update(monitoringTasks)
      .set({ status: 'completed' })
      .where(eq(monitoringTasks.id, task.id));
  }
}

/**
 * Мониторинг туров для группы
 */
export async function monitorGroupTours(groupId: number) {
  const [group] = await db.select()
    .from(groupProfiles)
    .where(eq(groupProfiles.id, groupId))
    .limit(1);

  if (!group || !group.isActive) return;

  const aggregatedProfile = group.aggregatedProfile as any;
  if (!aggregatedProfile) return;

  logger.info(`Monitoring tours for group ${group.chatId}`);

  // Поиск туров по агрегированным параметрам
  const searchParams = {
    countries: aggregatedProfile.countries,
    budget: aggregatedProfile.budget,
    startDate: aggregatedProfile.startDate,
    endDate: aggregatedProfile.endDate,
    duration: aggregatedProfile.tripDuration,
    peopleCount: (group.memberIds as string[]).length * 2
  };

  const foundTours = await searchTours(searchParams);

  // Анализируем и сохраняем лучшие туры для группы
  const topTours = [];
  for (const tourData of foundTours) {
    const { score, details, analysis } = await calculateTourMatchScore(
      tourData,
      searchParams,
      group.aggregatedPriorities as Record<string, number> || {}
    );

    if (score >= NOTIFICATION_THRESHOLD - 10) { // Немного ниже порог для групп
      topTours.push({ tourData, score, analysis });
    }
  }

  // Сортируем по соответствию
  topTours.sort((a, b) => b.score - a.score);

  // Отправляем топ-3 тура в группу для голосования
  if (topTours.length > 0) {
    await sendGroupTourOptions(group.chatId, topTours.slice(0, 3));
  }
}

/**
 * Отправка уведомления о найденном туре
 */
async function sendTourNotification(userId: string, tour: any, score: number, analysis: string) {
  const bot = getBot();
  
  const message = `🎯 Найден отличный тур для вас!\n\n` +
    `${tour.title}\n` +
    `⭐ ${tour.starRating} звезд${tour.beachLine ? `, ${tour.beachLine} линия` : ''}\n` +
    `🍽 ${tour.mealType}\n` +
    `💰 ${tour.price.toLocaleString('ru-RU')} ₽\n` +
    `📅 ${tour.departureDate ? new Date(tour.departureDate).toLocaleDateString('ru-RU') : 'Гибкие даты'}\n` +
    `✈️ ${tour.duration} ночей\n\n` +
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
    await bot.sendPhoto(userId, tour.photoUrl || 'https://via.placeholder.com/400x300', {
      caption: message,
      reply_markup: keyboard
    });
  } catch (error) {
    // Если не удалось отправить фото, отправляем текст
    await bot.sendMessage(userId, message, { reply_markup: keyboard });
  }
}

/**
 * Отправка уведомления о дедлайне с альтернативами
 */
async function sendDeadlineNotification(userId: string, alternatives: any[]) {
  const bot = getBot();
  
  let message = `⏰ Достигнут дедлайн поиска туров!\n\n` +
    `К сожалению, не удалось найти туры, полностью соответствующие вашим критериям. ` +
    `Вот несколько альтернативных вариантов:\n\n`;

  const buttons = [];

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
  };

  await bot.sendMessage(userId, message, { reply_markup: keyboard });
}

/**
 * Отправка вариантов туров для голосования в группе
 */
async function sendGroupTourOptions(chatId: string, tours: any[]) {
  const bot = getBot();
  
  const message = `🗳 Найдены туры для вашей группы! Голосуйте за понравившиеся варианты:\n\n`;

  for (let i = 0; i < tours.length; i++) {
    const { tourData, score, analysis } = tours[i];
    
    const tourMessage = `${i + 1}. ${tourData.title}\n` +
      `⭐ ${tourData.stars} звезд, 💰 ${tourData.price.toLocaleString('ru-RU')} ₽\n` +
      `📊 Соответствие: ${score}%\n`;

    const keyboard = {
      inline_keyboard: [
        [
          { text: '👍', callback_data: `vote_yes_${tourData.id}` },
          { text: '👎', callback_data: `vote_no_${tourData.id}` },
          { text: '🤔', callback_data: `vote_maybe_${tourData.id}` }
        ],
        [
          { text: '🔗 Подробнее', url: tourData.link }
        ]
      ]
    };

    await bot.sendMessage(chatId, tourMessage, { reply_markup: keyboard });
  }
}