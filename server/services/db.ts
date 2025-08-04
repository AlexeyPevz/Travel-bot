import { db } from '@/db';
import { tourCache } from '@/shared/schema';
import { eq } from 'drizzle-orm';
import logger from '../utils/logger';

export const dbService = {
  /**
   * Сохранение туров в кэш базы данных
   */
  async saveTourCache(tours: any[], searchKey: string): Promise<void> {
    try {
      await db.insert(tourCache).values({
        searchKey,
        tours,
        createdAt: new Date(),
      });
      logger.info(`Saved ${tours.length} tours to cache`, { searchKey });
    } catch (error) {
      logger.error('Error saving tours to cache', { error, searchKey });
    }
  },

  /**
   * Пакетное сохранение туров
   */
  async saveTourBatch(tours: any[]): Promise<any[]> {
    try {
      // Временная заглушка - возвращаем туры с сгенерированными ID
      return tours.map((tour, index) => ({
        ...tour,
        id: tour.id || `tour-${Date.now()}-${index}`,
      }));
    } catch (error) {
      logger.error('Error saving tour batch', { error });
      return [];
    }
  },

  /**
   * Получение туров из кэша
   */
  async getTourCache(searchKey: string): Promise<any[] | null> {
    try {
      const cached = await db
        .select()
        .from(tourCache)
        .where(eq(tourCache.searchKey, searchKey))
        .limit(1);

      if (cached.length > 0) {
        const cacheAge = Date.now() - cached[0].createdAt.getTime();
        const maxAge = 3600000; // 1 час

        if (cacheAge < maxAge) {
          logger.info(`Found cached tours`, { searchKey, count: cached[0].tours.length });
          return cached[0].tours;
        }
      }

      return null;
    } catch (error) {
      logger.error('Error getting tours from cache', { error, searchKey });
      return null;
    }
  },
};