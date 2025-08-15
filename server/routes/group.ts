import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validateBody, validateParams } from '../middleware/validation';
import { asyncHandler } from '../utils/errors';
import apiLogger from '../utils/logger';
import { db } from '../../db';
import { groupProfiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createOrUpdateGroupProfile, aggregateGroupProfiles, handleGroupVote } from '../services/groups';

const router = Router();

const createGroupSchema = z.object({
	chatId: z.string().min(1),
	chatTitle: z.string().min(1),
	memberIds: z.array(z.string().min(1)).min(1)
});

const voteSchema = z.object({
	groupId: z.string().min(1),
	tourId: z.number().int().positive(),
	userId: z.string().optional(),
	vote: z.enum(['yes', 'no', 'maybe']),
	comment: z.string().optional()
});

// Create or update group profile
router.post('/create', validateBody(createGroupSchema), asyncHandler(async (req: Request, res: Response) => {
	const { chatId, chatTitle, memberIds } = req.body;
	const groupId = await createOrUpdateGroupProfile(chatId, chatTitle, memberIds);
	await aggregateGroupProfiles(groupId);
	res.json({ groupId, message: 'Group profile created' });
}));

// Vote for a tour
router.post('/vote', validateBody(voteSchema), asyncHandler(async (req: Request, res: Response) => {
	try {
		const { groupId, tourId, userId, vote, comment } = req.body;
		if (!groupId || !tourId || !vote) {
			return res.status(400).json({ error: 'Missing required fields' });
		}
		const count = await handleGroupVote(Number(groupId), tourId, userId || 'unknown', vote, comment);
		res.json(count);
	} catch (error) {
		apiLogger.error('Error handling vote:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
}));

// Get group by chatId
router.get('/:chatId', validateParams(z.object({ chatId: z.string().min(1) })), asyncHandler(async (req: Request, res: Response) => {
	try {
		const { chatId } = req.params;
		const [group] = await db.select()
			.from(groupProfiles)
			.where(eq(groupProfiles.chatId, chatId))
			.limit(1);
		if (!group) return res.status(404).json({ error: 'Group not found' });
		res.json(group);
	} catch (error) {
		apiLogger.error('Error fetching group:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
}));

export default router;