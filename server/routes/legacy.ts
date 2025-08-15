import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { profiles, tours, tourMatches, tourPriorities } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { validateQuery } from '../middleware/validation';
import { asyncHandler, NotFoundError } from '../utils/errors';
import apiLogger from '../utils/logger';
import { cache, cacheKeys, CACHE_TTL } from '../services/cache';
import { searchTours } from '../providers';
import { tourSearchSchema } from '../validators/schemas';
import { calculateTourMatchScore } from '../services/openrouter';
import { sortTours } from '../utils/tours';

const router = Router();

// Redirect legacy profile reads to v1
router.get('/profile/:userId', (req, res) => {
	res.redirect(301, `/api/v1/profile/${req.params.userId}`);
});

// DEPRECATED: Old profile endpoint (to be removed)
router.get('/v0/profile/:userId', asyncHandler(async (req: any, res: any) => {
	const { userId } = req.params;
	const cacheKey = cacheKeys.profile(userId);
	const cached = await cache.get(cacheKey);
	if (cached) return res.json(cached);

	const [profile] = await db.select()
		.from(profiles)
		.where(eq(profiles.userId, userId))
		.limit(1);
	if (!profile) throw new NotFoundError('Profile not found');

	const [priorities] = await db.select()
		.from(tourPriorities)
		.where(eq(tourPriorities.userId, userId))
		.limit(1);

	const result = { ...profile, priorities: priorities || profile.priorities };
	await cache.set(cacheKey, result, CACHE_TTL.PROFILE);
	res.json(result);
}));

// Legacy tours search (deprecated)
router.get('/tours', validateQuery(tourSearchSchema), asyncHandler(async (req: Request, res: Response) => {
	try {
		const { userId, countries, budget, startDate, endDate } = req.query as any;
		res.setHeader('Deprecation', 'true');
		res.setHeader('Link', '</api/v1/tours>; rel="successor-version"');

		let searchParams: any = {};
		if (userId) {
			const [profile] = await db.select()
				.from(profiles)
				.where(eq(profiles.userId, userId as string))
				.limit(1);
			if (profile) {
				const countriesArr = (profile.countries as string[]) || [];
				searchParams = {
					destination: countriesArr[0] || 'Турция',
					budget: profile.budget || undefined,
					startDate: profile.startDate ? new Date(profile.startDate) : undefined,
					endDate: profile.endDate ? new Date(profile.endDate) : undefined,
					tripDuration: profile.tripDuration || undefined,
					departureCity: (profile as any).departureCity || 'Москва',
					adults: profile.adults || 2,
					children: profile.children || 0,
					childrenAges: (profile as any).childrenAges || []
				};
			}
		} else {
			const countriesList = countries ? (countries as string).split(',') : ['Турция'];
			searchParams = {
				destination: countriesList[0],
				budget: budget ? parseInt(budget as string) : undefined,
				startDate: startDate ? new Date(startDate as string) : undefined,
				endDate: endDate ? new Date(endDate as string) : undefined,
				departureCity: 'Москва',
				adults: 2,
				children: 0
			};
		}

		const toursCacheKey = cacheKeys.tourSearch({ ...(searchParams || {}), userId: userId || null });
		const cachedTours = await cache.get<any[]>(toursCacheKey);
		if (cachedTours) {
			const sortBy = ((req.query as any).sortBy as string) || 'match';
			const sorted = sortTours(cachedTours, sortBy as any);
			return res.json({ tours: sorted });
		}

		const found = await searchTours(searchParams);

		if (userId) {
			const [profile] = await db.select()
				.from(profiles)
				.where(eq(profiles.userId, userId as string))
				.limit(1);
			if (profile && profile.priorities) {
				const toursWithScores = await Promise.all(
					found.map(async (tour: any) => {
						const { score, details, analysis } = await calculateTourMatchScore(
							tour,
							searchParams,
							profile.priorities as Record<string, number>
						);
						return { ...tour, matchScore: score, matchDetails: details, aiAnalysis: analysis };
					})
				);
				const sortBy = ((req.query as any).sortBy as string) || 'match';
				const sorted = sortTours(toursWithScores, sortBy as any);
				await cache.set(toursCacheKey, sorted, CACHE_TTL.TOUR_SEARCH);
				return res.json({ tours: sorted });
			}
		}

		const sortBy = ((req.query as any).sortBy as string) || 'price';
		const sorted = sortTours(found, sortBy as any);
		await cache.set(toursCacheKey, sorted, CACHE_TTL.TOUR_SEARCH);
		res.json({ tours: sorted });
	} catch (error) {
		apiLogger.error('Error searching tours:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
}));

// Recommended tours
router.get('/tours/recommended/:userId', async (req, res) => {
	try {
		const { userId } = req.params;
		const matches = await db.select()
			.from(tourMatches)
			.leftJoin(tours, eq(tourMatches.tourId, tours.id))
			.where(eq(tourMatches.userId, userId))
			.orderBy(desc(tourMatches.matchScore))
			.limit(10);
		const recommendedTours = matches
			.filter(m => m.tours)
			.map(m => ({
				...m.tours,
				matchScore: m.tour_matches.matchScore,
				matchDetails: m.tour_matches.matchDetails
			}));
		res.json(recommendedTours);
	} catch (error) {
		apiLogger.error('Error fetching recommended tours:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

export default router;