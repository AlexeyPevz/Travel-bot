import { Router } from 'express';
import searchRoutes from './search';

const router = Router();

router.use('/search', searchRoutes);

router.get('/', (req, res) => {
  res.json({
    version: '2.0.0',
    description: 'Travel Bot API v2',
    endpoints: {
      search: '/api/v2/search',
    },
  });
});

export default router;