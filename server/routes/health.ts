import { Router } from 'express';
import { asyncHandler } from '../utils/errors';
import { getHealthStatus, getReadinessStatus, getLivenessStatus } from '../monitoring/health';

const router = Router();

router.get('/health', asyncHandler(async (req: any, res: any) => {
	const health = await getHealthStatus();
	res.status(health.status === 'healthy' ? 200 : 503).json(health);
}));

router.get('/health/ready', asyncHandler(async (req: any, res: any) => {
	const { ready, checks } = await getReadinessStatus();
	res.status(ready ? 200 : 503).json({ ready, checks });
}));

router.get('/health/live', (req, res) => {
	const liveness = getLivenessStatus();
	res.json(liveness);
});

export default router;