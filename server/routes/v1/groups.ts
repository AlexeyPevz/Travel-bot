import { Router } from 'express';

const router = Router();

// Groups endpoints will be implemented here
router.get('/', (req, res) => {
  res.json({ 
    message: 'Groups API v1',
    endpoints: {
      'GET /': 'List groups',
      'POST /': 'Create group',
      'GET /:groupId': 'Get group details',
      'PUT /:groupId': 'Update group',
      'DELETE /:groupId': 'Delete group',
    }
  });
});

export default router;