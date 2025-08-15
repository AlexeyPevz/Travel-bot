import { Router } from 'express';
import { searchTours } from '../../providers';
import { tourSearchSchema } from '../../validators/schemas';
import { validateBody, validateQuery } from '../../middleware/validation';
import { asyncHandler } from '../../utils/errors';
import { createRequestLogger } from '../../middleware/tracing';
import { trackAsyncOperation, tourSearchTotal, tourSearchDuration } from '../../monitoring/metrics';
import { sortTours } from '../../utils/tours';

const router = Router();

// Search tours
router.post('/search', validateBody(tourSearchSchema, { errorLabel: 'Validation Error', detailsMode: 'object' }), asyncHandler(async (req, res) => {
	const logger = createRequestLogger();
	const searchParams = req.body;
	
	logger.info('Searching tours', { params: searchParams });
	
	try {
		const tours = await trackAsyncOperation(
			tourSearchDuration,
			{ destination: searchParams.destination },
			async () => searchTours(searchParams)
		);
		
		tourSearchTotal.inc({ 
			destination: searchParams.destination, 
			status: 'success' 
		});

		// Optional scoring/sorting by relevance under flag
		let processedTours = tours.slice();
		const useSmartRanking = process.env.ENABLE_SMART_RANKING === 'true';
		const sortBy = (searchParams.sortBy || 'match') as 'match' | 'price' | 'stars' | 'rating';

		if (useSmartRanking && searchParams.userId) {
			try {
				const { db } = await import('../../../db');
				const { profiles } = await import('@shared/schema');
				const { eq } = await import('drizzle-orm');
				const [{ priorities } = {} as any] = await db.select().from(profiles).where(eq(profiles.userId, searchParams.userId)).limit(1);
				if (priorities) {
					const { calculateTourMatchScore } = await import('../../services/openrouter');
					const prefs = {
						countries: (searchParams.countries as string[] | undefined) || [],
						budget: searchParams.budget,
						startDate: searchParams.startDate,
						endDate: searchParams.endDate,
						duration: searchParams.duration,
						peopleCount: searchParams.peopleCount
					} as any;
					const withScores = await Promise.all(processedTours.map(async (t: any) => {
						const { score } = await calculateTourMatchScore(t, prefs, priorities as Record<string, number>);
						return { ...t, matchScore: score };
					}));
					processedTours = withScores;
				}
			} catch {}
		}

		// Apply sorting
		processedTours = sortTours(processedTours, sortBy);

		// Pagination (non-breaking: if page/pageSize not provided, fallback to limit/offset)
		const page = Number(searchParams.page) || 1;
		const pageSize = Number(searchParams.pageSize) || Number(searchParams.limit) || 20;
		const total = processedTours.length;
		const totalPages = Math.max(1, Math.ceil(total / pageSize));
		const startIdx = (page - 1) * pageSize;
		const endIdx = startIdx + pageSize;
		const paged = processedTours.slice(startIdx, endIdx);

		return res.json({ 
			tours: paged,
			pagination: { page, pageSize, total, totalPages },
			sortBy
		});
	} catch (error) {
		tourSearchTotal.inc({ 
			destination: searchParams.destination, 
			status: 'error' 
		});
		throw error;
	}
}));

// GET variant mirrors POST logic using query params
router.get('/', validateQuery(tourSearchSchema, { transformQuery: true }), asyncHandler(async (req, res) => {
	const searchParams = req.query as any;
	const tours = await searchTours(searchParams);
	let processedTours = tours.slice();
	const useSmartRanking = process.env.ENABLE_SMART_RANKING === 'true';
	const sortBy = (searchParams.sortBy || 'match') as 'match' | 'price' | 'stars' | 'rating';

	if (useSmartRanking && searchParams.userId) {
		try {
			const { db } = await import('../../../db');
			const { profiles } = await import('@shared/schema');
			const { eq } = await import('drizzle-orm');
			const [{ priorities } = {} as any] = await db.select().from(profiles).where(eq(profiles.userId, searchParams.userId)).limit(1);
			if (priorities) {
				const { calculateTourMatchScore } = await import('../../services/openrouter');
				const prefs = {
					countries: (searchParams.countries as string[] | undefined) || [],
					budget: searchParams.budget,
					startDate: searchParams.startDate,
					endDate: searchParams.endDate,
					duration: searchParams.duration,
					peopleCount: searchParams.peopleCount
				} as any;
				const withScores = await Promise.all(processedTours.map(async (t: any) => {
					const { score } = await calculateTourMatchScore(t, prefs, priorities as Record<string, number>);
					return { ...t, matchScore: score };
				}));
				processedTours = withScores;
			}
		} catch {}
	}

	processedTours = sortTours(processedTours, sortBy);

	const page = Number(searchParams.page) || 1;
	const pageSize = Number(searchParams.pageSize) || Number(searchParams.limit) || 20;
	const total = processedTours.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const startIdx = (page - 1) * pageSize;
	const endIdx = startIdx + pageSize;
	const paged = processedTours.slice(startIdx, endIdx);

	return res.json({ tours: paged, pagination: { page, pageSize, total, totalPages }, sortBy });
}));

export default router;