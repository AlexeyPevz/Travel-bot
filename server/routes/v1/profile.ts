import { Router } from 'express';
import { db } from '../../../db';
import { profiles } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { updateProfileSchema } from '../../validators/schemas';
import { validateBody } from '../../middleware/validation';
import { asyncHandler, NotFoundError } from '../../utils/errors';
import { createRequestLogger } from '../../middleware/tracing';
import { cache, cacheKeys, CACHE_TTL } from '../../services/cache';

const router = Router();

/**
 * @swagger
 * /profile/{userId}:
 *   get:
 *     summary: Get user profile
 *     tags: [Profile]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User profile found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       404:
 *         description: Profile not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
import { requireAuth, authorizeOwner } from '../../middleware/auth';

router.get('/:userId', requireAuth, authorizeOwner('userId'), asyncHandler(async (req, res) => {
  const logger = createRequestLogger();
  const { userId } = req.params;
  
  logger.info(`Fetching profile for user ${userId}`);
  
  // Check cache first
  const cacheKey = cacheKeys.userProfile(userId);
  const cached = await cache.get(cacheKey);
  if (cached) {
    logger.info(`Profile found in cache for user ${userId}`);
    return res.json(cached);
  }
  
  // Get from database
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId));
    
  if (!profile) {
    throw new NotFoundError('Profile not found');
  }
  
  // Cache the result
  await cache.set(cacheKey, profile, CACHE_TTL.PROFILE);
  
  res.json(profile);
}));

/**
 * @swagger
 * /profile:
 *   post:
 *     summary: Create new user profile
 *     tags: [Profile]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Profile'
 *     responses:
 *       201:
 *         description: Profile created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       409:
 *         description: Profile already exists
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                 profile:
 *                   $ref: '#/components/schemas/Profile'
 */
router.post('/', requireAuth, authorizeOwner('userId'), validateBody(updateProfileSchema), asyncHandler(async (req, res) => {
  const logger = createRequestLogger();
  const profileData = req.body;
  
  logger.info(`Creating profile for user ${profileData.userId}`);
  
  // Check if profile already exists
  const [existing] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, profileData.userId));
    
  if (existing) {
    return res.status(409).json({ 
      error: 'Profile already exists',
      profile: existing 
    });
  }
  
  // Create new profile
  const [newProfile] = await db
    .insert(profiles)
    .values({
      ...profileData,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
    
  // Cache the new profile
  const cacheKey = cacheKeys.userProfile(profileData.userId);
  await cache.set(cacheKey, newProfile, CACHE_TTL.PROFILE);
  
  res.status(201).json(newProfile);
}));

// Update profile
router.put('/:userId', requireAuth, authorizeOwner('userId'), validateBody(updateProfileSchema), asyncHandler(async (req, res) => {
  const logger = createRequestLogger();
  const { userId } = req.params;
  const updates = req.body;
  
  logger.info(`Updating profile for user ${userId}`);
  
  // Update in database
  const [updatedProfile] = await db
    .update(profiles)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId))
    .returning();
    
  if (!updatedProfile) {
    throw new NotFoundError('Profile not found');
  }
  
  // Invalidate cache
  const cacheKey = cacheKeys.userProfile(userId);
  await cache.delete(cacheKey);
  
  res.json(updatedProfile);
}));

// Delete profile
router.delete('/:userId', requireAuth, authorizeOwner('userId'), asyncHandler(async (req, res) => {
  const logger = createRequestLogger();
  const { userId } = req.params;
  
  logger.info(`Deleting profile for user ${userId}`);
  
  const [deleted] = await db
    .delete(profiles)
    .where(eq(profiles.userId, userId))
    .returning();
    
  if (!deleted) {
    throw new NotFoundError('Profile not found');
  }
  
  // Invalidate cache
  const cacheKey = cacheKeys.userProfile(userId);
  await cache.delete(cacheKey);
  
  res.json({ message: 'Profile deleted successfully' });
}));

export default router;