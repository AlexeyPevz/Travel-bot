import { Router, Request, Response } from 'express';
import { asyncHandler } from '../utils/errors';
import { getBot } from '../bot';

const router = Router();

router.post('/telegram/webhook', asyncHandler(async (req: Request, res: Response) => {
	try {
		if (process.env.TELEGRAM_USE_WEBHOOK !== 'true') {
			return res.status(404).json({ ok: false, description: 'Webhook disabled' });
		}
		const update = req.body;
		const bot = getBot();
		await (bot as any).processUpdate(update);
		res.json({ ok: true });
	} catch (error) {
		res.status(500).json({ ok: false });
	}
}));

export default router;