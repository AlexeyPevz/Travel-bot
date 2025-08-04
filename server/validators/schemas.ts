import { z } from 'zod';

// Profile validation schemas
export const profileSchema = z.object({
  userId: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  vacationType: z.enum(['beach', 'active', 'cultural', 'relaxing', 'family', 'romantic']).optional(),
  countries: z.array(z.string()).optional(),
  budget: z.number().min(0).max(10000000).optional(),
  budgetPerPerson: z.boolean().optional(),
  peopleCount: z.number().min(1).max(20).default(2),
  dateType: z.enum(['fixed', 'flexible']).optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  flexibleMonth: z.string().optional(),
  tripDuration: z.number().min(1).max(365).optional(),
  priorities: z.record(z.string(), z.number().min(0).max(10)).optional(),
  deadline: z.date().optional()
});

export const updateProfileSchema = profileSchema.partial().required({ userId: true });

// Tour search validation
export const tourSearchSchema = z.object({
  userId: z.string().optional(),
  countries: z.union([z.array(z.string()), z.string()]).optional(),
  budget: z.union([z.number(), z.string().transform(Number)]).optional(),
  startDate: z.union([z.date(), z.string().transform(s => new Date(s))]).optional(),
  endDate: z.union([z.date(), z.string().transform(s => new Date(s))]).optional(),
  duration: z.union([z.number(), z.string().transform(Number)]).optional(),
  peopleCount: z.union([z.number(), z.string().transform(Number)]).optional()
});

// Text analysis validation
export const analyzeRequestSchema = z.object({
  message: z.string().min(10).max(1000),
  userId: z.string().optional()
});

// Group validation
export const createGroupSchema = z.object({
  chatId: z.string().min(1),
  chatTitle: z.string().optional(),
  memberIds: z.array(z.string()).min(1)
});

// Vote validation
export const voteSchema = z.object({
  groupId: z.number(),
  tourId: z.number(),
  userId: z.string().min(1),
  vote: z.enum(['yes', 'no', 'maybe']),
  comment: z.string().max(500).optional()
});

// Watchlist validation
export const watchlistSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  countries: z.array(z.string()).optional(),
  budgetRange: z.object({
    min: z.number().min(0),
    max: z.number().min(0)
  }).optional(),
  priorities: z.record(z.string(), z.number().min(0).max(10)).optional()
});

// Validation middleware
export function validate<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

// Query validation middleware
export function validateQuery<T>(schema: z.ZodSchema<T>) {
  return (req: any, res: any, next: any) => {
    try {
      const validated = schema.parse(req.query);
      req.query = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation error',
          details: error.errors
        });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}