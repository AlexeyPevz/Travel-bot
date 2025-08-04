import { db } from '../../db';
import { monitoringTasks } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Запланировать уведомление о туре
 */
export async function scheduleTourNotification(
  userId: string,
  profileId: number,
  delay: number = 30 * 60 * 1000 // 30 минут по умолчанию
) {
  const nextRunAt = new Date(Date.now() + delay);
  
  await db.insert(monitoringTasks)
    .values({
      userId,
      profileId,
      taskType: 'profile_monitor',
      nextRunAt,
      status: 'active'
    })
    .onConflictDoNothing();
}

/**
 * Запланировать проверку дедлайна
 */
export async function scheduleDeadlineCheck(
  userId: string,
  profileId: number,
  deadline: Date
) {
  await db.insert(monitoringTasks)
    .values({
      userId,
      profileId,
      taskType: 'deadline_check',
      nextRunAt: deadline,
      status: 'active',
      metadata: { deadline: deadline.toISOString() }
    })
    .onConflictDoNothing();
}

/**
 * Отменить задачи мониторинга для пользователя
 */
export async function cancelUserMonitoring(userId: string) {
  await db.update(monitoringTasks)
    .set({ status: 'cancelled' })
    .where(eq(monitoringTasks.userId, userId));
}

/**
 * Обновить время следующего запуска задачи
 */
export async function rescheduleTask(taskId: number, nextRunAt: Date) {
  await db.update(monitoringTasks)
    .set({ nextRunAt })
    .where(eq(monitoringTasks.id, taskId));
}