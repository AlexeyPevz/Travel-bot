import { db } from '@db';
import { 
  backgroundSearches, 
  backgroundSearchResults, 
  searchRequests, 
  notifications,
  tours,
  NotifyConditions,
  SearchRequest,
  Tour
} from '@shared/schema-v2';
import { eq, and, gte, lte, inArray, sql, desc } from 'drizzle-orm';
import { searchTours } from '../providers';
import { rankTours } from './smart-tour-ranking';
import logger from '../utils/logger';
import { sendNotification } from './notification-service';

/**
 * Создает фоновый поиск для отслеживания новых туров
 */
export async function createBackgroundSearch(
  searchRequestId: number,
  userId: string,
  monitorUntil: Date,
  conditions?: Partial<NotifyConditions>
) {
  try {
    // Проверяем, есть ли уже активный фоновый поиск для этого запроса
    const existing = await db.select()
      .from(backgroundSearches)
      .where(
        and(
          eq(backgroundSearches.searchRequestId, searchRequestId),
          eq(backgroundSearches.isActive, true)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Обновляем существующий
      await db.update(backgroundSearches)
        .set({
          monitorUntil,
          notifyConditions: conditions || existing[0].notifyConditions,
          updatedAt: new Date()
        })
        .where(eq(backgroundSearches.id, existing[0].id));
      
      return existing[0].id;
    }

    // Создаем новый фоновый поиск
    const [created] = await db.insert(backgroundSearches).values({
      searchRequestId,
      userId,
      monitorUntil,
      notifyConditions: conditions || {
        notifyNewTours: true,
        priceDropPercent: 10,
        minMatchScore: 70
      }
    }).returning();

    logger.info(`Created background search ${created.id} for user ${userId}`);
    return created.id;
  } catch (error) {
    logger.error('Error creating background search:', error);
    throw error;
  }
}

/**
 * Проверяет все активные фоновые поиски
 */
export async function checkBackgroundSearches() {
  try {
    // Получаем активные поиски, которые нужно проверить
    const activeSearches = await db.select({
      backgroundSearch: backgroundSearches,
      searchRequest: searchRequests
    })
    .from(backgroundSearches)
    .innerJoin(searchRequests, eq(backgroundSearches.searchRequestId, searchRequests.id))
    .where(
      and(
        eq(backgroundSearches.isActive, true),
        eq(backgroundSearches.isPaused, false),
        gte(backgroundSearches.monitorUntil, new Date())
      )
    );

    logger.info(`Checking ${activeSearches.length} background searches`);

    for (const { backgroundSearch, searchRequest } of activeSearches) {
      try {
        await checkSingleBackgroundSearch(backgroundSearch, searchRequest);
      } catch (error) {
        logger.error(`Error checking background search ${backgroundSearch.id}:`, error);
      }
    }
  } catch (error) {
    logger.error('Error in background searches check:', error);
  }
}

/**
 * Проверяет один фоновый поиск
 */
async function checkSingleBackgroundSearch(
  bgSearch: typeof backgroundSearches.$inferSelect,
  searchRequest: SearchRequest
) {
  const startTime = Date.now();
  
  try {
    // Проверяем тихие часы
    if (isQuietHours(bgSearch.notifyConditions as NotifyConditions)) {
      logger.debug(`Skipping search ${bgSearch.id} - quiet hours`);
      return;
    }

    // Выполняем поиск с теми же параметрами
    const searchParams = {
      destination: searchRequest.destination?.[0] || 'Турция',
      startDate: searchRequest.startDate || undefined,
      endDate: searchRequest.endDate || undefined,
      flexibleMonth: searchRequest.flexibleMonth || undefined,
      tripDuration: searchRequest.duration || undefined,
      budget: searchRequest.budget || undefined,
      departureCity: (searchRequest as any).departureCity || 'Москва',
      adults: searchRequest.adults || 2,
      children: searchRequest.children || 0,
      childrenAges: searchRequest.childrenAges as number[] || []
    };

    const foundTours = await searchTours(searchParams);
    
    // Ранжируем туры
    const rankedTours = searchRequest.priorities 
      ? rankTours(foundTours, searchRequest, searchRequest.priorities)
      : foundTours.map(tour => ({ tour, score: 50, breakdown: {} as any }));

    // Получаем предыдущие результаты для сравнения
    const previousResults = await db.select()
      .from(backgroundSearchResults)
      .where(eq(backgroundSearchResults.backgroundSearchId, bgSearch.id))
      .orderBy(desc(backgroundSearchResults.foundAt));

    const previousTourIds = new Set(previousResults.map(r => r.tourId));
    const previousPrices = new Map(previousResults.map(r => [r.tourId, r.price]));

    // Анализируем изменения
    const notifications: Array<{
      tour: Tour;
      reason: string;
      priceChange?: number;
      score: number;
    }> = [];

    const conditions = bgSearch.notifyConditions as NotifyConditions || {};

    for (const { tour, score } of rankedTours) {
      // Проверяем минимальный score
      if (conditions.minMatchScore && score < conditions.minMatchScore) {
        continue;
      }

      // Новый тур
      if (conditions.notifyNewTours && !previousTourIds.has(tour.id)) {
        notifications.push({
          tour,
          reason: 'new_tour',
          score
        });
        continue;
      }

      // Изменение цены
      const previousPrice = previousPrices.get(tour.id);
      if (previousPrice) {
        const priceChange = previousPrice - tour.price;
        const priceChangePercent = (priceChange / previousPrice) * 100;

        if (
          (conditions.priceDropAmount && priceChange >= conditions.priceDropAmount) ||
          (conditions.priceDropPercent && priceChangePercent >= conditions.priceDropPercent) ||
          (conditions.priceBelowThreshold && tour.price <= conditions.priceBelowThreshold)
        ) {
          notifications.push({
            tour,
            reason: 'price_drop',
            priceChange,
            score
          });
        }
      }
    }

    // Ограничиваем количество уведомлений
    const maxNotifications = conditions.onlyTopMatches ? 3 : (conditions.maxNotificationsPerDay || 10);
    const topNotifications = notifications
      .sort((a, b) => b.score - a.score)
      .slice(0, maxNotifications);

    // Сохраняем результаты и отправляем уведомления
    for (const notification of topNotifications) {
      const { tour, reason, priceChange, score } = notification;

      // Сохраняем результат
      const [result] = await db.insert(backgroundSearchResults).values({
        backgroundSearchId: bgSearch.id,
        tourId: tour.id,
        price: tour.price,
        priceChange,
        availability: tour.availability,
        notificationReason: reason
      }).returning();

      // Отправляем уведомление
      await sendBackgroundSearchNotification(
        bgSearch.userId,
        bgSearch.id,
        tour,
        reason,
        priceChange,
        score
      );

      // Отмечаем как уведомленное
      await db.update(backgroundSearchResults)
        .set({
          isNotified: true,
          notifiedAt: new Date()
        })
        .where(eq(backgroundSearchResults.id, result.id));
    }

    // Обновляем статистику
    await db.update(backgroundSearches)
      .set({
        lastCheckedAt: new Date(),
        checksCount: sql`${backgroundSearches.checksCount} + 1`,
        notificationsCount: sql`${backgroundSearches.notificationsCount} + ${topNotifications.length}`,
        lastNotificationAt: topNotifications.length > 0 ? new Date() : bgSearch.lastNotificationAt,
        updatedAt: new Date()
      })
      .where(eq(backgroundSearches.id, bgSearch.id));

    const duration = Date.now() - startTime;
    logger.info(`Background search ${bgSearch.id} completed in ${duration}ms, sent ${topNotifications.length} notifications`);

  } catch (error) {
    logger.error(`Error in background search ${bgSearch.id}:`, error);
    throw error;
  }
}

/**
 * Отправляет уведомление о найденном туре
 */
async function sendBackgroundSearchNotification(
  userId: string,
  backgroundSearchId: number,
  tour: Tour,
  reason: string,
  priceChange?: number,
  score?: number
) {
  let title = '';
  let message = '';

  switch (reason) {
    case 'new_tour':
      title = '🆕 Новый тур найден!';
      message = `Найден новый тур, который вам подходит:\n\n`;
      break;
    
    case 'price_drop':
      const dropAmount = priceChange ? priceChange.toLocaleString('ru-RU') : '';
      title = `💰 Цена снизилась на ${dropAmount} ₽!`;
      message = `Цена на тур снизилась:\n\n`;
      break;
    
    case 'availability_change':
      title = '✅ Тур снова доступен!';
      message = `Тур, который вы искали, снова доступен:\n\n`;
      break;
  }

  message += `🏨 ${tour.hotel} ${tour.hotelStars}⭐\n`;
  message += `📍 ${tour.destination}\n`;
  message += `💵 ${tour.price.toLocaleString('ru-RU')} ₽\n`;
  
  if (tour.startDate && tour.endDate) {
    message += `📅 ${new Date(tour.startDate).toLocaleDateString('ru-RU')} - ${new Date(tour.endDate).toLocaleDateString('ru-RU')}\n`;
  }
  
  if (tour.mealType) {
    message += `🍴 ${tour.mealType}\n`;
  }
  
  if (score) {
    message += `\n🎯 Соответствие: ${Math.round(score)}%`;
  }

  // Создаем уведомление
  const [notification] = await db.insert(notifications).values({
    userId,
    type: 'background_search',
    sourceId: backgroundSearchId,
    title,
    message,
    data: {
      tourId: tour.id,
      reason,
      priceChange,
      score
    },
    actionUrl: tour.link,
    actionData: {
      callback: `view_bg_tour_${tour.id}`,
      tourId: tour.id
    }
  }).returning();

  // Отправляем через сервис уведомлений
  await sendNotification(notification.id);
}

/**
 * Проверяет, находимся ли мы в тихих часах
 */
function isQuietHours(conditions: NotifyConditions): boolean {
  if (!conditions.quietHours) return false;

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = conditions.quietHours.start.split(':').map(Number);
  const [endHour, endMinute] = conditions.quietHours.end.split(':').map(Number);
  
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  if (startTime <= endTime) {
    // Тихие часы в пределах одного дня
    return currentTime >= startTime && currentTime < endTime;
  } else {
    // Тихие часы переходят через полночь
    return currentTime >= startTime || currentTime < endTime;
  }
}

/**
 * Приостанавливает фоновый поиск
 */
export async function pauseBackgroundSearch(backgroundSearchId: number, userId: string) {
  await db.update(backgroundSearches)
    .set({
      isPaused: true,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(backgroundSearches.id, backgroundSearchId),
        eq(backgroundSearches.userId, userId)
      )
    );
}

/**
 * Возобновляет фоновый поиск
 */
export async function resumeBackgroundSearch(backgroundSearchId: number, userId: string) {
  await db.update(backgroundSearches)
    .set({
      isPaused: false,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(backgroundSearches.id, backgroundSearchId),
        eq(backgroundSearches.userId, userId)
      )
    );
}

/**
 * Останавливает фоновый поиск
 */
export async function stopBackgroundSearch(backgroundSearchId: number, userId: string) {
  await db.update(backgroundSearches)
    .set({
      isActive: false,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(backgroundSearches.id, backgroundSearchId),
        eq(backgroundSearches.userId, userId)
      )
    );
}

/**
 * Получает активные фоновые поиски пользователя
 */
export async function getUserBackgroundSearches(userId: string) {
  return await db.select({
    backgroundSearch: backgroundSearches,
    searchRequest: searchRequests
  })
  .from(backgroundSearches)
  .innerJoin(searchRequests, eq(backgroundSearches.searchRequestId, searchRequests.id))
  .where(
    and(
      eq(backgroundSearches.userId, userId),
      eq(backgroundSearches.isActive, true)
    )
  )
  .orderBy(desc(backgroundSearches.createdAt));
}