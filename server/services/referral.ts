import { db } from '../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Создать реферальный код для пользователя
 */
export function createReferralCode(userId: string): string {
  // Простой реферальный код на основе userId
  return `ref_${userId}`;
}

/**
 * Добавить реферала
 */
export async function addReferral(userId: string, referrerId: string) {
  // Проверяем, что пользователь не реферал сам себя
  if (userId === referrerId) {
    return false;
  }

  // Проверяем, существует ли реферер
  const [referrer] = await db.select()
    .from(profiles)
    .where(eq(profiles.userId, referrerId))
    .limit(1);

  if (!referrer) {
    return false;
  }

  // Обновляем профиль пользователя
  await db.update(profiles)
    .set({ referrerId })
    .where(eq(profiles.userId, userId));

  return true;
}

/**
 * Получить статистику рефералов
 */
export async function getReferralStats(userId: string) {
  // Получаем всех рефералов пользователя
  const referrals = await db.select()
    .from(profiles)
    .where(eq(profiles.referrerId, userId));

  return {
    totalReferrals: referrals.length,
    referrals: referrals.map(r => ({
      userId: r.userId,
      name: r.name,
      joinedAt: r.createdAt
    }))
  };
}

/**
 * Получить реферальную ссылку
 */
export function getReferralLink(botUsername: string, userId: string): string {
  const code = createReferralCode(userId);
  return `https://t.me/${botUsername}?start=${code}`;
}