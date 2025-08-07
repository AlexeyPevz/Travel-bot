import { pgTable, serial, text, integer, timestamp, jsonb, boolean, real, uniqueIndex, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Profiles table - хранит профили пользователей
export const profiles = pgTable('profiles', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  name: text('name'),
  vacationType: text('vacation_type'), // Тип отдыха
  countries: jsonb('countries'), // массив предпочитаемых стран
  budget: integer('budget'), // максимальный бюджет
  startDate: date('start_date'), // начало периода
  endDate: date('end_date'), // конец периода  
  tripDuration: integer('trip_duration'), // желаемая длительность в днях
  priorities: jsonb('priorities'), // объект с приоритетами пользователя для разных типов отдыха
  adults: integer('adults').default(2), // количество взрослых
  children: integer('children').default(0), // количество детей
  childrenAges: jsonb('children_ages'), // массив возрастов детей
  preferences: jsonb('preferences'), // дополнительные предпочтения
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').default(true)
});

// Типы для профиля
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

// Tour priorities - веса важности параметров для пользователя
export const tourPriorities = pgTable('tour_priorities', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  starRating: real('star_rating').default(5), // важность звездности (0-10)
  beachLine: real('beach_line').default(5), // важность линии пляжа
  mealType: real('meal_type').default(5), // важность типа питания
  hotelRating: real('hotel_rating').default(5), // важность рейтинга отеля
  priceValue: real('price_value').default(8), // важность цены
  roomQuality: real('room_quality').default(5), // важность качества номера
  location: real('location').default(5), // важность расположения
  familyFriendly: real('family_friendly').default(5), // важность для семей с детьми
  adults: real('adults').default(5), // важность для взрослого отдыха
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Group profiles - профили групповых чатов
export const groupProfiles = pgTable('group_profiles', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull().unique(),
  chatTitle: text('chat_title'),
  memberIds: jsonb('member_ids').$type<string[]>().default([]),
  aggregatedProfile: jsonb('aggregated_profile').$type<Partial<Profile>>(),
  aggregatedPriorities: jsonb('aggregated_priorities').$type<Record<string, number>>(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Watchlists - желания без конкретных дат
export const watchlists = pgTable('watchlists', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  title: text('title'),
  description: text('description'),
  countries: jsonb('countries').$type<string[]>(),
  budgetRange: jsonb('budget_range').$type<{min: number, max: number}>(),
  priorities: jsonb('priorities').$type<Record<string, number>>(),
  isActive: boolean('is_active').default(true),
  lastChecked: timestamp('last_checked'),
  createdAt: timestamp('created_at').defaultNow()
});

// Tours - найденные туры
export const tours = pgTable('tours', {
  id: serial('id').primaryKey(),
  providerId: text('provider_id').notNull(),
  provider: text('provider').notNull(), // leveltravel, etc.
  externalId: text('external_id'),
  title: text('title').notNull(),
  country: text('country'),
  resort: text('resort'),
  hotelName: text('hotel_name'),
  starRating: integer('star_rating'),
  beachLine: integer('beach_line'),
  mealType: text('meal_type'),
  price: integer('price').notNull(),
  pricePerPerson: boolean('price_per_person').default(false),
  currency: text('currency').default('RUB'),
  departureDate: timestamp('departure_date'),
  returnDate: timestamp('return_date'),
  duration: integer('duration'), // nights
  hotelRating: real('hotel_rating'),
  reviewsCount: integer('reviews_count'),
  photoUrl: text('photo_url'),
  detailsUrl: text('details_url'),
  bookingUrl: text('booking_url'),
  metadata: jsonb('metadata'),
  matchScore: real('match_score'), // процент соответствия профилю
  aiAnalysis: text('ai_analysis'), // анализ от AI
  createdAt: timestamp('created_at').defaultNow()
});

// Tour matches - соответствия туров профилям
export const tourMatches = pgTable('tour_matches', {
  id: serial('id').primaryKey(),
  tourId: integer('tour_id').references(() => tours.id),
  userId: text('user_id'),
  profileId: integer('profile_id').references(() => profiles.id),
  groupId: integer('group_id').references(() => groupProfiles.id),
  matchScore: real('match_score').notNull(),
  matchDetails: jsonb('match_details').$type<Record<string, number>>(),
  isNotified: boolean('is_notified').default(false),
  notifiedAt: timestamp('notified_at'),
  userAction: text('user_action'), // viewed, liked, rejected, booked
  createdAt: timestamp('created_at').defaultNow()
});

// Bookings - бронирования
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  tourId: integer('tour_id').references(() => tours.id),
  status: text('status').notNull(), // pending, confirmed, cancelled
  bookingDetails: jsonb('booking_details'),
  remindersSent: jsonb('reminders_sent').$type<string[]>().default([]),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Travel buddy requests - запросы попутчиков
export const travelBuddyRequests = pgTable('travel_buddy_requests', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  destination: text('destination'),
  dateRange: jsonb('date_range').$type<{start: Date, end: Date}>(),
  budget: integer('budget'),
  preferences: jsonb('preferences'),
  status: text('status').default('active'), // active, matched, expired
  matchedWith: text('matched_with'),
  createdAt: timestamp('created_at').defaultNow()
});

// Group tour votes - голосование за туры в группах
export const groupTourVotes = pgTable('group_tour_votes', {
  id: serial('id').primaryKey(),
  groupId: integer('group_id').references(() => groupProfiles.id),
  tourId: integer('tour_id').references(() => tours.id),
  userId: text('user_id').notNull(),
  vote: text('vote').notNull(), // yes, no, maybe
  comment: text('comment'),
  createdAt: timestamp('created_at').defaultNow()
}, (table) => ({
  uniqueVote: uniqueIndex('unique_vote').on(table.groupId, table.tourId, table.userId)
}));

// Monitoring tasks - задачи фонового мониторинга
export const monitoringTasks = pgTable('monitoring_tasks', {
  id: serial('id').primaryKey(),
  userId: text('user_id'),
  profileId: integer('profile_id').references(() => profiles.id),
  watchlistId: integer('watchlist_id').references(() => watchlists.id),
  groupId: integer('group_id').references(() => groupProfiles.id),
  taskType: text('task_type').notNull(), // profile_monitor, watchlist_monitor, deadline_check
  nextRunAt: timestamp('next_run_at').notNull(),
  lastRunAt: timestamp('last_run_at'),
  status: text('status').default('active'), // active, paused, completed
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow()
});

// Tour parameters - дополнительные параметры туров
export const tourParameters = pgTable('tour_parameters', {
  id: serial('id').primaryKey(),
  tourId: integer('tour_id').references(() => tours.id),
  parameterType: text('parameter_type').notNull(), // beachLine, slopeDistance, etc
  parameterValue: real('parameter_value'), // числовое значение
  parameterText: text('parameter_text'), // текстовое значение
  createdAt: timestamp('created_at').defaultNow()
});

// Relations
export const profilesRelations = relations(profiles, ({ many }) => ({
  tourMatches: many(tourMatches),
  bookings: many(bookings),
  monitoringTasks: many(monitoringTasks)
}));

export const toursRelations = relations(tours, ({ many }) => ({
  tourMatches: many(tourMatches),
  bookings: many(bookings),
  groupVotes: many(groupTourVotes)
}));

export const groupProfilesRelations = relations(groupProfiles, ({ many }) => ({
  tourMatches: many(tourMatches),
  votes: many(groupTourVotes),
  monitoringTasks: many(monitoringTasks)
}));