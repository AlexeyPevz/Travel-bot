import { db } from '../db';
import { profiles, watchlists, tours, bookings } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

export const storage = {
  // Profile operations
  async getProfile(userId: string) {
    const [profile] = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    return profile;
  },

  async saveProfile(userId: string, data: any) {
    const [existingProfile] = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (existingProfile) {
      const [updated] = await db.update(profiles)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(profiles.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(profiles)
        .values({ userId, ...data })
        .returning();
      return created;
    }
  },

  // Watchlist operations
  async getWatchlists(userId: string) {
    return await db.select()
      .from(watchlists)
      .where(and(
        eq(watchlists.userId, userId),
        eq(watchlists.isActive, true)
      ))
      .orderBy(desc(watchlists.createdAt));
  },

  async createWatchlist(data: any) {
    const [watchlist] = await db.insert(watchlists)
      .values(data)
      .returning();
    return watchlist;
  },

  // Tour operations
  async saveTour(tourData: any) {
    const [tour] = await db.insert(tours)
      .values(tourData)
      .onConflictDoUpdate({
        target: [tours.provider, tours.externalId],
        set: {
          price: tourData.price,
          updatedAt: new Date()
        }
      })
      .returning();
    return tour;
  },

  async getTourById(tourId: number) {
    const [tour] = await db.select()
      .from(tours)
      .where(eq(tours.id, tourId))
      .limit(1);
    return tour;
  },

  // Booking operations
  async createBooking(data: any) {
    const [booking] = await db.insert(bookings)
      .values(data)
      .returning();
    return booking;
  },

  async getUserBookings(userId: string) {
    return await db.select()
      .from(bookings)
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.createdAt));
  }
};