import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateParams } from '../middleware/validation';
import { asyncHandler } from '../utils/errors';
import apiLogger from '../utils/logger';
import { db } from '../../db';
import { watchlists } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

const watchlistSchema = z.object({
	userId: z.string().min(1),
	tourId: z.number().int().positive(),
	notes: z.string().optional()
});

// Create watchlist entry
router.post('/', validateBody(watchlistSchema), asyncHandler(async (req: Request, res: Response) => {
	try {
		const watchlistData = req.body;
		const [watchlist] = await db.insert(watchlists).values(watchlistData).returning();
		res.json(watchlist);
	} catch (error) {
		apiLogger.error('Error creating watchlist:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
}));

// Get user watchlists
router.get('/:userId', validateParams(z.object({ userId: z.string().min(1) })), asyncHandler(async (req: Request, res: Response) => {
	try {
		const { userId } = req.params;
		const userWatchlists = await db.select().from(watchlists).where(eq(watchlists.userId, userId));
		res.json(userWatchlists);
	} catch (error) {
		apiLogger.error('Error fetching watchlists:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
}));

export default router;