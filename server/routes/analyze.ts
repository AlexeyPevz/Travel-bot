import { Router, Request, Response } from 'express';
import { validateBody } from '../middleware/validation';
import { analyzeRequestSchema } from '../validators/schemas';
import { asyncHandler } from '../utils/errors';
import apiLogger from '../utils/logger';
import { db } from '../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { analyzeTourRequest } from '../services/openrouter';

const router = Router();

router.post('/analyze-request', validateBody(analyzeRequestSchema), asyncHandler(async (req: Request, res: Response) => {
	try {
		const { message, userId } = req.body;
		if (!message) return res.status(400).json({ error: 'Message is required' });
		const preferences = await analyzeTourRequest(message);
		if (userId && preferences) {
			await db.update(profiles)
				.set({
					vacationType: preferences.vacationType,
					countries: preferences.countries,
					budget: preferences.budget,
					startDate: preferences.startDate ? preferences.startDate.toISOString().split('T')[0] : null,
					endDate: preferences.endDate ? preferences.endDate.toISOString().split('T')[0] : null,
					tripDuration: preferences.duration,
					adults: preferences.peopleCount || 2,
					children: 0,
					priorities: preferences.priorities,
					updatedAt: new Date()
				})
				.where(eq(profiles.userId, userId));
		}
		const sortBy = (req.query.sortBy as string) || 'match';
		(preferences as any)._sortBy = sortBy;
		res.json(preferences);
	} catch (error) {
		apiLogger.error('Error analyzing request:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
}));

export default router;