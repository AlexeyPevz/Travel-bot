import { pgTable, serial, text, integer, boolean, timestamp, jsonb, real, date, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const travelStyleEnum = pgEnum('travel_style', ['budget', 'comfort', 'luxury']);
export const searchStatusEnum = pgEnum('search_status', ['draft', 'ready', 'searching', 'completed', 'cancelled']);
export const dateTypeEnum = pgEnum('date_type', ['fixed', 'flexible', 'anytime']);

// ========== ОСНОВНЫЕ ТАБЛИЦЫ ==========

// Постоянный профиль пользователя (только базовые данные)
export const userProfiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(), // Telegram ID
  name: text('name'),
  departureCity: text('departure_city').default('Москва'),
  preferredCountries: jsonb('preferred_countries').$type<string[]>(), // Любимые направления
  travelStyle: travelStyleEnum('travel_style').default('comfort'),
  defaultPriorities: jsonb('default_priorities').$type<TravelPriorities>(), // Дефолтные веса
  language: text('language').default('ru'),
  phoneNumber: text('phone_number'),
  email: text('email'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  isActive: boolean('is_active').default(true)
});

// Поисковые запросы (каждый поиск - отдельная запись)
export const searchRequests = pgTable('search_requests', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  
  // Исходный запрос
  rawText: text('raw_text'), // Что написал пользователь
  
  // Распарсенные параметры
  destination: jsonb('destination').$type<string[]>(), // Страны/города
  dateType: dateTypeEnum('date_type').default('flexible'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  flexibleMonth: text('flexible_month'), // "август", "лето 2024"
  duration: integer('duration'), // Количество ночей
  
  // Бюджет
  budget: integer('budget'),
  budgetType: text('budget_type').default('total'), // 'total' | 'perPerson'
  currency: text('currency').default('RUB'),
  
  // Состав путешественников
  adults: integer('adults').default(2),
  children: integer('children').default(0),
  childrenAges: jsonb('children_ages').$type<number[]>(),
  
  // Предпочтения по размещению
  roomPreferences: jsonb('room_preferences').$type<RoomPreferences>(),
  
  // Требования и предпочтения для этого поиска
  requirements: jsonb('requirements').$type<string[]>(), // ["all_inclusive", "animation", "sand_beach"]
  priorities: jsonb('priorities').$type<TravelPriorities>(), // Веса для этого поиска
  
  // AI контекст
  aiContext: jsonb('ai_context'), // Для продолжения диалога
  missingParams: jsonb('missing_params').$type<string[]>(), // Что еще нужно узнать
  
  // Статус
  status: searchStatusEnum('status').default('draft'),
  completedAt: timestamp('completed_at'),
  
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// История взаимодействий с AI
export const aiInteractions = pgTable('ai_interactions', {
  id: serial('id').primaryKey(),
  searchRequestId: integer('search_request_id').notNull(),
  messageType: text('message_type'), // 'user' | 'assistant' | 'system'
  content: text('content'),
  metadata: jsonb('metadata'), // Дополнительная информация
  createdAt: timestamp('created_at').defaultNow()
});

// Приоритеты (веса) для разных типов отдыха
export const priorityProfiles = pgTable('priority_profiles', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(), // "Пляжный отдых", "Активный отдых", etc
  description: text('description'),
  isDefault: boolean('is_default').default(false),
  weights: jsonb('weights').$type<PriorityWeights>().notNull(),
  createdAt: timestamp('created_at').defaultNow()
});

// ========== РЕЗУЛЬТАТЫ И ИСТОРИЯ ==========

// Результаты поиска
export const searchResults = pgTable('search_results', {
  id: serial('id').primaryKey(),
  searchRequestId: integer('search_request_id').notNull(),
  tourId: integer('tour_id').notNull(),
  
  // Скоринг
  matchScore: real('match_score'), // 0-100
  scoreBreakdown: jsonb('score_breakdown').$type<ScoreBreakdown>(),
  aiRecommendation: text('ai_recommendation'), // Почему AI рекомендует этот тур
  
  // Взаимодействие пользователя
  isViewed: boolean('is_viewed').default(false),
  isSaved: boolean('is_saved').default(false),
  isBooked: boolean('is_booked').default(false),
  
  viewedAt: timestamp('viewed_at'),
  savedAt: timestamp('saved_at'),
  bookedAt: timestamp('booked_at'),
  
  createdAt: timestamp('created_at').defaultNow()
});

// ========== ГРУППОВЫЕ ПОИСКИ ==========

export const groupSearches = pgTable('group_searches', {
  id: serial('id').primaryKey(),
  chatId: text('chat_id').notNull(), // Telegram chat ID
  initiatorId: text('initiator_id').notNull(),
  
  // Участники и их запросы
  participantIds: jsonb('participant_ids').$type<string[]>().notNull(),
  individualRequestIds: jsonb('individual_request_ids').$type<number[]>(), // IDs from searchRequests
  
  // Объединенные параметры
  mergedDestinations: jsonb('merged_destinations').$type<string[]>(),
  mergedDateRange: jsonb('merged_date_range').$type<{start: string, end: string}>(),
  totalBudget: integer('total_budget'),
  totalAdults: integer('total_adults'),
  totalChildren: integer('total_children'),
  
  // Компромиссы
  compromises: jsonb('compromises').$type<GroupCompromises>(),
  groupPriorities: jsonb('group_priorities').$type<TravelPriorities>(),
  
  status: searchStatusEnum('status').default('draft'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// ========== АНАЛИТИКА И ОБУЧЕНИЕ ==========

export const userInsights = pgTable('user_insights', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  
  // Статистика
  totalSearches: integer('total_searches').default(0),
  totalBookings: integer('total_bookings').default(0),
  
  // Выученные предпочтения
  favoriteDestinations: jsonb('favorite_destinations').$type<DestinationStats[]>(),
  averageBudget: integer('average_budget'),
  averageDuration: integer('average_duration'),
  typicalTravelStyle: text('typical_travel_style'),
  seasonalPreferences: jsonb('seasonal_preferences').$type<SeasonalPrefs>(),
  
  // Паттерны поведения
  searchPatterns: jsonb('search_patterns'),
  bookingPatterns: jsonb('booking_patterns'),
  
  lastUpdated: timestamp('last_updated').defaultNow(),
  createdAt: timestamp('created_at').defaultNow()
});

// ========== ТИПЫ ==========

// Предпочтения по номерам
export interface RoomPreferences {
  // Количество и тип комнат
  roomsCount?: number;           // Количество номеров (для больших групп/семей)
  roomType?: RoomType;           // Тип размещения
  
  // Кровати
  bedsConfiguration?: BedsConfig; // Конфигурация кроватей
  separateBeds?: boolean;        // Раздельные кровати
  
  // Вид из номера
  viewPreference?: ViewType;     // Предпочтения по виду
  viewImportance?: number;       // Насколько важен вид (0-10)
  
  // Расположение номера
  floor?: FloorPreference;       // Предпочтения по этажу
  quietRoom?: boolean;           // Тихий номер (вдали от лифтов/дискотек)
  
  // Дополнительные удобства
  balcony?: boolean;             // Наличие балкона/террасы
  kitchenette?: boolean;         // Мини-кухня
  connectingRooms?: boolean;     // Смежные номера (для семей)
  accessible?: boolean;          // Для людей с ограниченными возможностями
  
  // Размер номера
  minSquareMeters?: number;      // Минимальная площадь номера
  
  // Специальные требования
  specialRequests?: string[];    // ["детская кроватка", "ванна", "мини-бар"]
}

export type RoomType = 
  | 'standard'      // Стандартный номер
  | 'superior'      // Улучшенный номер
  | 'deluxe'        // Делюкс
  | 'suite'         // Люкс
  | 'junior_suite'  // Джуниор сюит
  | 'family'        // Семейный номер
  | 'studio'        // Студия
  | 'apartment'     // Апартаменты
  | 'villa'         // Вилла
  | 'bungalow';     // Бунгало

export interface BedsConfig {
  doubleBeds?: number;    // Количество двуспальных кроватей
  singleBeds?: number;    // Количество односпальных кроватей
  kingSizeBed?: boolean;  // Кровать king-size
  sofaBed?: boolean;      // Диван-кровать
}

export type ViewType = 
  | 'sea'           // Вид на море
  | 'sea_side'      // Боковой вид на море
  | 'pool'          // Вид на бассейн
  | 'garden'        // Вид на сад
  | 'mountain'      // Вид на горы
  | 'city'          // Вид на город
  | 'no_preference' // Не важно
  | 'land';         // Вид на территорию

export type FloorPreference = 
  | 'ground'        // Первый этаж
  | 'low'           // Нижние этажи (2-3)
  | 'middle'        // Средние этажи
  | 'high'          // Высокие этажи
  | 'top'           // Последние этажи
  | 'no_preference';// Не важно

// Приоритеты и веса
export interface TravelPriorities {
  profileName?: string;
  weights: PriorityWeights;
}

export interface PriorityWeights {
  price: number;         // 0-10
  starRating: number;    // 0-10
  beachLine: number;     // 0-10
  mealType: number;      // 0-10
  location: number;      // 0-10
  reviews: number;       // 0-10
  familyFriendly: number; // 0-10
  activities: number;    // 0-10
  quietness: number;     // 0-10
  roomQuality: number;   // 0-10 - новый параметр для важности качества номера
}

export interface ScoreBreakdown {
  price: number;
  stars: number;
  beach: number;
  meal: number;
  location: number;
  reviews: number;
  family: number;
  activities: number;
  quietness: number;
  total: number;
}

export interface GroupCompromises {
  [userId: string]: {
    parameter: string;
    originalValue: any;
    compromisedValue: any;
    importance: number;
  }[];
}

export interface DestinationStats {
  destination: string;
  searchCount: number;
  bookingCount: number;
  averageRating: number;
}

export interface SeasonalPrefs {
  [month: string]: {
    destinations: string[];
    avgBudget: number;
  };
}

// ========== СВЯЗИ ==========

export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  searchRequests: many(searchRequests),
  insights: many(userInsights)
}));

export const searchRequestsRelations = relations(searchRequests, ({ one, many }) => ({
  user: one(userProfiles, {
    fields: [searchRequests.userId],
    references: [userProfiles.userId]
  }),
  aiInteractions: many(aiInteractions),
  searchResults: many(searchResults)
}));

export const searchResultsRelations = relations(searchResults, ({ one }) => ({
  searchRequest: one(searchRequests, {
    fields: [searchResults.searchRequestId],
    references: [searchRequests.id]
  }),
  tour: one(tours, {
    fields: [searchResults.tourId],
    references: [tours.id]
  })
}));

// ========== СУЩЕСТВУЮЩИЕ ТАБЛИЦЫ (для совместимости) ==========

export const tours = pgTable('tours', {
  id: serial('id').primaryKey(),
  provider: text('provider').notNull(),
  externalId: text('external_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  destination: text('destination').notNull(),
  hotel: text('hotel').notNull(),
  hotelStars: integer('hotel_stars'),
  price: integer('price').notNull(),
  priceOld: integer('price_old'),
  rating: real('rating'),
  startDate: date('start_date'),
  endDate: date('end_date'),
  nights: integer('nights').notNull(),
  roomType: text('room_type'),
  mealType: text('meal_type'),
  beachLine: integer('beach_line'),
  link: text('link').notNull(),
  image: text('image'),
  images: jsonb('images').$type<string[]>(),
  departureCity: text('departure_city'),
  arrivalCity: text('arrival_city'),
  tourOperatorId: text('tour_operator_id'),
  beachDistance: integer('beach_distance'),
  beachType: text('beach_type'),
  beachSurface: text('beach_surface'),
  airportDistance: integer('airport_distance'),
  hasWifi: boolean('has_wifi'),
  hasPool: boolean('has_pool'),
  hasKidsClub: boolean('has_kids_club'),
  hasFitness: boolean('has_fitness'),
  hasAquapark: boolean('has_aquapark'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  instantConfirm: boolean('instant_confirm'),
  isHot: boolean('is_hot'),
  pricePerNight: integer('price_per_night'),
  availability: text('availability'),
  matchScore: real('match_score').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

// Типы для новых таблиц
export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;
export type SearchRequest = typeof searchRequests.$inferSelect;
export type NewSearchRequest = typeof searchRequests.$inferInsert;
export type Tour = typeof tours.$inferSelect;