import { searchTours } from '../providers';
import { calculateTourMatchScore } from './openrouter';
import { storage } from '../storage';
import { db } from '../../db';
import { tours, tourMatches } from '@shared/schema';
import { and, eq, gte } from 'drizzle-orm';

interface TourSearchParams {
  countries?: string[];
  budget?: number;
  startDate?: Date;
  endDate?: Date;
  duration?: number;
  peopleCount?: number;
}

/**
 * Получить все туры с учетом профиля пользователя
 */
export async function getAllTours(query: TourSearchParams & { userId?: string }) {
  const { userId, ...searchParams } = query;
  
  // Получаем туры от провайдеров
  const foundTours = await searchTours(searchParams);
  
  // Если есть userId, считаем соответствие
  if (userId) {
    const profile = await storage.getProfile(userId);
    if (profile && profile.priorities) {
      const toursWithScores = await Promise.all(
        foundTours.map(async (tour) => {
          const { score, details, analysis } = await calculateTourMatchScore(
            tour,
            searchParams,
            profile.priorities as Record<string, number>
          );
          
          // Сохраняем тур в БД
          const savedTour = await storage.saveTour({
            provider: tour.provider,
            providerId: tour.provider,
            externalId: tour.id,
            title: tour.title,
            country: tour.country,
            resort: tour.resort,
            hotelName: tour.hotelName,
            starRating: tour.stars,
            beachLine: tour.beachLine,
            mealType: tour.mealType,
            price: tour.price,
            departureDate: tour.startDate,
            returnDate: tour.endDate,
            duration: tour.nights,
            hotelRating: tour.rating,
            photoUrl: tour.photoUrl,
            detailsUrl: tour.link,
            bookingUrl: tour.link,
            matchScore: score,
            aiAnalysis: analysis
          });
          
          // Сохраняем соответствие
          if (score >= 75) { // Сохраняем туры с хорошим соответствием
            await db.insert(tourMatches)
              .values({
                tourId: savedTour.id,
                userId: profile.userId,
                profileId: profile.id,
                matchScore: score,
                matchDetails: details
              })
              .onConflictDoNothing();
          }
          
          return { ...tour, matchScore: score, matchDetails: details, aiAnalysis: analysis };
        })
      );
      
      // Сортируем по соответствию
      toursWithScores.sort((a, b) => b.matchScore - a.matchScore);
      return toursWithScores;
    }
  }
  
  return foundTours;
}

/**
 * Получить рекомендованные туры для пользователя
 */
export async function getRecommendedTours(userId: string, limit = 10) {
  const matches = await db.select({
    tour: tours,
    match: tourMatches
  })
    .from(tourMatches)
    .leftJoin(tours, eq(tourMatches.tourId, tours.id))
    .where(
      and(
        eq(tourMatches.userId, userId),
        gte(tourMatches.matchScore, 80)
      )
    )
    .limit(limit);

  return matches.map(({ tour, match }) => ({
    ...tour,
    matchScore: match.matchScore,
    matchDetails: match.matchDetails
  }));
}

/**
 * Поиск туров по watchlist
 */
export async function searchToursForWatchlist(watchlist: any) {
  const searchParams: TourSearchParams = {
    countries: watchlist.countries,
    budget: watchlist.budgetRange?.max,
    peopleCount: 2 // По умолчанию
  };
  
  const tours = await getAllTours({
    ...searchParams,
    userId: watchlist.userId
  });
  
  // Фильтруем по минимальному бюджету
  if (watchlist.budgetRange?.min) {
    return tours.filter(tour => tour.price >= watchlist.budgetRange.min);
  }
  
  return tours;
}