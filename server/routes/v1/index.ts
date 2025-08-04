import { Router } from 'express';
import profileRoutes from './profile';
import toursRoutes from './tours';
import groupsRoutes from './groups';
import authRoutes from './auth';

const router = Router();

// API v1 routes
router.use('/profile', profileRoutes);
router.use('/tours', toursRoutes);
router.use('/groups', groupsRoutes);
router.use('/auth', authRoutes);

// API v1 info endpoint
router.get('/', (req, res) => {
  res.json({
    version: '1.0.0',
    description: 'Travel Bot API v1',
    endpoints: {
      profile: '/api/v1/profile',
      tours: '/api/v1/tours',
      groups: '/api/v1/groups',
      auth: '/api/v1/auth',
    },
    deprecated: false,
    documentation: '/api/docs',
  });
});

export default router;