import { Router } from 'express';

const router = Router();

// Auth endpoints will be implemented here
router.get('/', (req, res) => {
  res.json({ 
    message: 'Auth API v1',
    endpoints: {
      'POST /login': 'User login',
      'POST /logout': 'User logout',
      'POST /refresh': 'Refresh token',
      'GET /me': 'Get current user',
    }
  });
});

export default router;