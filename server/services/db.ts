import { db } from '@db';
import { tours as toursTable } from '@shared/schema';
import logger from '../utils/logger';

export const dbService = {
  /**
   * Пакетное сохранение туров в таблицу `tours`
   */
  async saveTourBatch(tours: any[]): Promise<any[]> {
    try {
      if (!tours || tours.length === 0) return [];

      const prepared = tours.map((t) => ({
        providerId: t.provider || null,
        provider: t.provider,
        externalId: t.externalId?.toString() ?? null,
        title: t.title,
        country: t.country ?? t.destination ?? null,
        resort: t.resort ?? null,
        hotelName: t.hotel ?? null,
        starRating: t.hotelStars ?? null,
        beachLine: typeof t.beachLine === 'number' ? t.beachLine : null,
        mealType: t.mealType ?? null,
        price: t.price,
        pricePerPerson: false,
        currency: t.currency ?? 'RUB',
        departureDate: t.startDate ?? null,
        returnDate: t.endDate ?? null,
        duration: t.nights ?? t.duration ?? null,
        hotelRating: t.rating ?? null,
        reviewsCount: t.reviews ?? null,
        photoUrl: t.image ?? null,
        detailsUrl: t.detailsUrl ?? null,
        bookingUrl: t.link ?? t.bookingUrl ?? null,
        metadata: t.metadata ?? null,
        matchScore: t.matchScore ?? 0,
        aiAnalysis: t.aiAnalysis ?? null,
        createdAt: new Date(),
      }));

      const inserted = await db.insert(toursTable).values(prepared).returning();
      logger.info(`Inserted ${inserted.length} tours`);
      return inserted;
    } catch (error) {
      logger.error('Error saving tour batch', { error });
      return [];
    }
  },
};