import { z } from 'zod';

/**
 * Общие схемы
 */
export const userIdSchema = z.string().regex(/^\d+$/, 'User ID must be numeric');

export const dateSchema = z.string().datetime().or(z.date()).transform((val) => {
	return typeof val === 'string' ? new Date(val) : val;
});

export const countrySchema = z.string().min(2).max(50);

export const budgetSchema = z.number().int().positive().max(10000000);

export const peopleCountSchema = z.number().int().min(1).max(20);

export const prioritySchema = z.number().min(0).max(10);

/**
 * Схема для профиля пользователя
 */
export const profileSchema = z.object({
	userId: userIdSchema,
	name: z.string().min(1).max(100).optional(),
	telegramUsername: z.string().max(50).optional(),
	vacationType: z.enum(['beach', 'active', 'cultural', 'relaxing', 'family', 'romantic', 'adventure']).optional(),
	countries: z.array(countrySchema).max(10).optional(),
	destination: z.string().max(100).optional(),
	dateType: z.enum(['fixed', 'flexible']).optional(),
	startDate: dateSchema.optional(),
	endDate: dateSchema.optional(),
	flexibleMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
	tripDuration: z.number().int().min(1).max(90).optional(),
	budget: budgetSchema.optional(),
	budgetPerPerson: z.boolean().optional(),
	peopleCount: peopleCountSchema.optional(),
	priorities: z.record(z.string(), prioritySchema).optional(),
	deadline: dateSchema.optional(),
	referrerId: userIdSchema.optional()
});

export const createProfileSchema = profileSchema.required({
	userId: true
});

export const updateProfileSchema = profileSchema.partial();

/**
 * Схема для анализа текстового запроса
 */
export const analyzeRequestSchema = z.object({
	message: z.string().min(5).max(1000),
	userId: userIdSchema
});

/**
 * Схема для поиска туров
 */
export const tourSearchSchema = z.object({
	userId: userIdSchema.optional(),
	countries: z.array(countrySchema).min(1).max(5).optional(),
	startDate: dateSchema.optional(),
	endDate: dateSchema.optional(),
	duration: z.number().int().min(1).max(30).optional(),
	budget: budgetSchema.optional(),
	peopleCount: peopleCountSchema.optional(),
	starRating: z.number().int().min(1).max(5).optional(),
	mealType: z.enum(['ro', 'bb', 'hb', 'fb', 'ai', 'uai']).optional(),
	beachLine: z.number().int().min(1).max(5).optional(),
	// legacy pagination
	limit: z.number().int().min(1).max(50).default(20),
	offset: z.number().int().min(0).default(0),
	// new pagination and sorting (backward compatible)
	page: z.number().int().min(1).default(1).optional(),
	pageSize: z.number().int().min(1).max(50).default(20).optional(),
	sortBy: z.enum(['match', 'price', 'stars', 'rating']).default('match').optional()
});

/**
 * Схема для группового профиля
 */
export const groupProfileSchema = z.object({
	chatId: z.string().regex(/^-?\d+$/),
	chatTitle: z.string().max(255).optional(),
	memberIds: z.array(userIdSchema).min(1).max(50),
	isActive: z.boolean().default(true)
});

export const createGroupSchema = groupProfileSchema.required({
	chatId: true
});

/**
 * Схема для голосования за тур
 */
export const tourVoteSchema = z.object({
	groupId: z.number().int().positive(),
	tourId: z.number().int().positive(),
	userId: userIdSchema,
	vote: z.enum(['yes', 'no', 'maybe']),
	comment: z.string().max(500).optional()
});

/**
 * Схема для списка наблюдения (watchlist)
 */
export const watchlistSchema = z.object({
	userId: userIdSchema,
	title: z.string().min(1).max(100),
	description: z.string().max(500).optional(),
	countries: z.array(countrySchema).min(1).max(10).optional(),
	budgetRange: z.object({
		min: budgetSchema,
		max: budgetSchema
	}).refine(data => data.min <= data.max, {
		message: 'Min budget must be less than or equal to max budget'
	}).optional(),
	priorities: z.record(z.string(), prioritySchema).optional(),
	isActive: z.boolean().default(true)
});

/**
 * Схема для задачи мониторинга
 */
export const monitoringTaskSchema = z.object({
	userId: userIdSchema.optional(),
	profileId: z.number().int().positive().optional(),
	watchlistId: z.number().int().positive().optional(),
	groupId: z.number().int().positive().optional(),
	taskType: z.enum(['profile_monitor', 'watchlist_monitor', 'deadline_check']),
	nextRunAt: dateSchema,
	status: z.enum(['active', 'paused', 'completed']).default('active'),
	metadata: z.record(z.any()).optional()
});

/**
 * Схема для бронирования
 */
export const bookingSchema = z.object({
	userId: userIdSchema,
	tourId: z.number().int().positive(),
	status: z.enum(['pending', 'confirmed', 'cancelled']),
	bookingDetails: z.object({
		contactPhone: z.string().regex(/^\+?\d{10,15}$/),
		contactEmail: z.string().email(),
		passengers: z.array(z.object({
			firstName: z.string().min(1).max(50),
			lastName: z.string().min(1).max(50),
			birthDate: dateSchema,
			passportNumber: z.string().min(5).max(20),
			passportExpiry: dateSchema
		})).min(1).max(10),
		specialRequests: z.string().max(1000).optional()
	}).optional()
});

/**
 * Схема для реферальной системы
 */
export const referralSchema = z.object({
	referrerId: userIdSchema,
	referredId: userIdSchema,
	status: z.enum(['pending', 'completed', 'expired']).default('pending'),
	reward: z.number().min(0).optional()
});

/**
 * Схема для попутчиков
 */
export const travelBuddyRequestSchema = z.object({
	userId: userIdSchema,
	destination: z.string().min(2).max(100),
	dateRange: z.object({
		start: dateSchema,
		end: dateSchema
	}).refine(data => data.start < data.end, {
		message: 'Start date must be before end date'
	}),
	budget: budgetSchema.optional(),
	preferences: z.object({
		ageRange: z.object({
			min: z.number().int().min(18).max(100),
			max: z.number().int().min(18).max(100)
		}).optional(),
		gender: z.enum(['male', 'female', 'any']).optional(),
		interests: z.array(z.string()).max(10).optional(),
		languages: z.array(z.string()).max(5).optional()
	}).optional(),
	status: z.enum(['active', 'matched', 'expired']).default('active')
});

/**
 * Схема для настроек уведомлений
 */
export const notificationSettingsSchema = z.object({
	userId: userIdSchema,
	emailNotifications: z.boolean().default(true),
	pushNotifications: z.boolean().default(true),
	smsNotifications: z.boolean().default(false),
	notificationTypes: z.object({
		newTours: z.boolean().default(true),
		priceDrops: z.boolean().default(true),
		deadlineReminders: z.boolean().default(true),
		groupUpdates: z.boolean().default(true),
		buddyRequests: z.boolean().default(false)
	}).optional(),
	quietHours: z.object({
		enabled: z.boolean().default(false),
		startTime: z.string().regex(/^\d{2}:\d{2}$/),
		endTime: z.string().regex(/^\d{2}:\d{2}$/)
	}).optional()
});

/**
 * Схема для обратной связи
 */
export const feedbackSchema = z.object({
	userId: userIdSchema,
	type: z.enum(['bug', 'feature', 'improvement', 'other']),
	subject: z.string().min(5).max(100),
	message: z.string().min(10).max(2000),
	attachments: z.array(z.string().url()).max(5).optional(),
	rating: z.number().int().min(1).max(5).optional()
});

/**
 * Схема для статистики
 */
export const statisticsQuerySchema = z.object({
	userId: userIdSchema.optional(),
	startDate: dateSchema.optional(),
	endDate: dateSchema.optional(),
	metric: z.enum(['searches', 'bookings', 'views', 'matches']).optional(),
	groupBy: z.enum(['day', 'week', 'month']).optional()
});

/**
 * Утилиты для валидации
 */
export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): T {
	return schema.parse(data);
}

export function validateRequestSafe<T>(schema: z.ZodSchema<T>, data: unknown): 
	{ success: true; data: T } | { success: false; error: z.ZodError } {
	const result = schema.safeParse(data);
	if (result.success) {
		return { success: true, data: result.data };
	}
	return { success: false, error: result.error };
}