import { Router } from 'express';
import { validateBody } from '../../middleware/validation';
import { asyncHandler } from '../../utils/errors';
import { z } from 'zod';

const router = Router();

const v2SearchSchema = z.object({
	query: z.string().min(3).max(2000).optional(),
	userId: z.string().regex(/^\d+$/).optional(),
	// direct params fallback (if no query)
	destination: z.string().min(2).max(100).optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
	tripDuration: z.number().int().min(1).max(30).optional(),
	budget: z.number().int().min(1).max(10000000).optional(),
	adults: z.number().int().min(1).max(10).optional(),
	children: z.number().int().min(0).max(10).optional(),
	childrenAges: z.array(z.number().int().min(0).max(17)).optional(),
	sortBy: z.enum(['match', 'price', 'stars', 'rating']).optional(),
	page: z.number().int().min(1).default(1).optional(),
	pageSize: z.number().int().min(1).max(50).default(20).optional()
});

router.post('/', validateBody(v2SearchSchema), asyncHandler(async (req, res) => {
	const {
		query,
		userId,
		destination,
		startDate,
		endDate,
		tripDuration,
		budget,
		adults = 2,
		children = 0,
		childrenAges = [],
		sortBy = 'match',
		page = 1,
		pageSize = 20
	} = req.body;

	const enableAi = process.env.ENABLE_AI_PARSING === 'true';

	// Analyze query via AI (optional)
	let parsed: any = {};
	if (enableAi && query) {
		try {
			const { parseTravelRequest } = await import('../../services/ai-travel-assistant');
			const userProfile = null; // optional enhancement: load v2 user profile
			parsed = await parseTravelRequest(query, userProfile as any, undefined);
		} catch {}
	}

	// Build search params with fallbacks
	const searchParams: any = {
		destination: parsed?.destinations?.[0] || destination || 'Турция',
		startDate: parsed?.startDate || (startDate ? new Date(startDate) : undefined),
		endDate: parsed?.endDate || (endDate ? new Date(endDate) : undefined),
		tripDuration: parsed?.duration || tripDuration,
		budget: parsed?.budget || budget,
		adults: parsed?.adults || adults,
		children: parsed?.children || children,
		childrenAges: parsed?.childrenAges || childrenAges,
		sortBy,
		page,
		pageSize
	};

	// Execute provider search
	const { searchTours } = await import('../../providers');
	let tours: any[] = [];
	try {
		tours = await searchTours(searchParams);
	} catch (e) {
		return res.status(500).json({ error: 'Search failed', details: (e as Error).message });
	}

	// Optional: persist v2 request
	if (process.env.ENABLE_NEW_PROFILE === 'true' && userId) {
		try {
			const { db } = await import('../../../db');
			const { searchRequests } = await import('@shared/schema-v2');
			await db.insert(searchRequests).values({
				userId,
				rawText: query,
				destination: [searchParams.destination],
				startDate: searchParams.startDate,
				endDate: searchParams.endDate,
				duration: searchParams.tripDuration,
				budget: searchParams.budget,
				adults: searchParams.adults,
				children: searchParams.children,
				childrenAges: searchParams.childrenAges,
				status: 'ready'
			}).returning();
		} catch {}
	}

	// Basic pagination client-side (providers currently return finite list)
	const total = tours.length;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));
	const startIdx = (page - 1) * pageSize;
	const endIdx = startIdx + pageSize;
	const pageItems = tours.slice(startIdx, endIdx);

	return res.json({
		query: { query, userId },
		params: searchParams,
		results: pageItems,
		pagination: { page, pageSize, total, totalPages },
		sortBy
	});
}));

export default router;