import { Router } from 'express';
import { searchTours } from '../../providers';
import { tourSearchSchema } from '../../validators/schemas';
import { validateBody } from '../../middleware/validation';
import { asyncHandler } from '../../utils/errors';
import { createRequestLogger } from '../../middleware/tracing';
import { trackAsyncOperation, tourSearchTotal, tourSearchDuration } from '../../monitoring/metrics';

const router = Router();

// Search tours
router.post('/search', validateBody(tourSearchSchema), asyncHandler(async (req, res) => {
  const logger = createRequestLogger();
  const searchParams = req.body;
  
  logger.info('Searching tours', { params: searchParams });
  
  try {
    const tours = await trackAsyncOperation(
      tourSearchDuration,
      { destination: searchParams.destination },
      async () => searchTours(searchParams)
    );
    
    tourSearchTotal.inc({ 
      destination: searchParams.destination, 
      status: 'success' 
    });
    
    res.json({ tours });
  } catch (error) {
    tourSearchTotal.inc({ 
      destination: searchParams.destination, 
      status: 'error' 
    });
    throw error;
  }
}));

export default router;