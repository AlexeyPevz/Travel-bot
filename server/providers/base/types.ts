/**
 * Базовые типы для системы провайдеров туристических услуг
 */

/**
 * Типы провайдеров услуг
 */
export enum ProviderType {
  TOURS = 'tours',
  HOTELS = 'hotels',
  FLIGHTS = 'flights',
  TRANSFERS = 'transfers',
  EXCURSIONS = 'excursions',
  RENTALS = 'rentals',
  INSURANCE = 'insurance',
  AUTHOR_TOURS = 'author_tours'
}

/**
 * Статус провайдера
 */
export enum ProviderStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
  ERROR = 'error'
}

/**
 * Опции сортировки
 */
export enum SortOption {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  RATING = 'rating',
  RELEVANCE = 'relevance',
  POPULARITY = 'popularity',
  DATE = 'date'
}

/**
 * Базовые параметры поиска
 */
export interface BaseSearchParams {
  // Основные параметры
  destination?: string;      // Направление
  startDate?: Date;         // Дата начала
  endDate?: Date;           // Дата окончания
  adults?: number;          // Взрослые
  children?: number;        // Дети
  childrenAges?: number[];  // Возраст детей
  
  // Бюджет
  budget?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  
  // Фильтры
  filters?: Record<string, any>;
  
  // Пагинация
  page?: number;
  limit?: number;
  
  // Сортировка
  sortBy?: SortOption;
  sortOrder?: 'asc' | 'desc';
  
  // Дополнительные параметры
  locale?: string;          // Язык результатов
  userId?: string;          // ID пользователя для персонализации
}

/**
 * Параметры поиска туров
 */
export interface TourSearchParams extends BaseSearchParams {
  hotelStars?: number[];
  mealTypes?: string[];
  beachLine?: number;
  tripDuration?: number;
  tourOperators?: string[];
}

/**
 * Параметры поиска отелей
 */
export interface HotelSearchParams extends BaseSearchParams {
  stars?: number[];
  amenities?: string[];
  propertyTypes?: string[];
  distanceFromCenter?: number;
  checkIn?: string;         // Время заезда
  checkOut?: string;        // Время выезда
}

/**
 * Параметры поиска авиабилетов
 */
export interface FlightSearchParams extends BaseSearchParams {
  origin: string;           // Аэропорт вылета
  destination: string;      // Аэропорт прилета
  departureDate: Date;      // Дата вылета
  returnDate?: Date;        // Дата возврата (для туда-обратно)
  cabinClass?: 'economy' | 'business' | 'first';
  directOnly?: boolean;     // Только прямые рейсы
  airlines?: string[];      // Предпочитаемые авиакомпании
}

/**
 * Базовый результат поиска
 */
export interface BaseResult {
  // Идентификация
  id: string;               // Внутренний ID
  providerId: string;       // ID у провайдера
  provider: string;         // Название провайдера
  
  // Основная информация
  title: string;
  description?: string;
  
  // Цены
  price: {
    amount: number;
    currency: string;
    oldAmount?: number;     // Цена до скидки
    breakdown?: PriceBreakdown[];
  };
  
  // Медиа
  images: string[];
  mainImage?: string;
  
  // Метаданные
  rating?: number;
  reviews?: number;
  
  // Ссылки
  bookingUrl: string;       // Ссылка на бронирование
  detailsUrl?: string;      // Ссылка на детали
  
  // Служебные данные
  metadata?: any;           // Дополнительные данные провайдера
  score?: number;           // Релевантность результата
  
  // Временные метки
  createdAt?: Date;
  updatedAt?: Date;
  expiresAt?: Date;         // Когда истекает предложение
}

/**
 * Разбивка цены
 */
export interface PriceBreakdown {
  type: 'base' | 'tax' | 'fee' | 'discount' | 'other';
  amount: number;
  currency: string;
  description?: string;
}

/**
 * Результат поиска тура
 */
export interface TourResult extends BaseResult {
  destination: string;
  hotel: string;
  hotelStars?: number;
  nights: number;
  roomType?: string;
  mealType?: string;
  beachLine?: string;
  departureCity?: string;
  tourOperator?: string;
}

/**
 * Результат поиска отеля
 */
export interface HotelResult extends BaseResult {
  location: {
    address?: string;
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  stars?: number;
  amenities?: string[];
  propertyType?: string;
  checkInTime?: string;
  checkOutTime?: string;
  distanceFromCenter?: number;
  nearbyAttractions?: string[];
}

/**
 * Результат поиска авиабилета
 */
export interface FlightResult extends BaseResult {
  segments: FlightSegment[];
  duration: number;         // Общая продолжительность в минутах
  airlines: string[];
  cabinClass: string;
  baggage?: BaggageInfo;
}

/**
 * Сегмент перелета
 */
export interface FlightSegment {
  origin: AirportInfo;
  destination: AirportInfo;
  departureTime: Date;
  arrivalTime: Date;
  duration: number;
  flightNumber: string;
  airline: string;
  aircraft?: string;
  layovers?: number;
}

/**
 * Информация об аэропорте
 */
export interface AirportInfo {
  code: string;
  name: string;
  city: string;
  terminal?: string;
}

/**
 * Информация о багаже
 */
export interface BaggageInfo {
  included: boolean;
  pieces?: number;
  weight?: number;
  dimensions?: string;
  additionalFee?: number;
}

/**
 * Параметры бронирования
 */
export interface BookingParams {
  resultId: string;
  customer: CustomerInfo;
  passengers?: PassengerInfo[];
  payment?: PaymentInfo;
  specialRequests?: string;
}

/**
 * Информация о клиенте
 */
export interface CustomerInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality?: string;
}

/**
 * Информация о пассажире
 */
export interface PassengerInfo extends CustomerInfo {
  dateOfBirth: Date;
  documentType?: 'passport' | 'id_card';
  documentNumber?: string;
  documentExpiry?: Date;
}

/**
 * Информация об оплате
 */
export interface PaymentInfo {
  method: 'card' | 'bank_transfer' | 'cash' | 'other';
  details?: any;
}

/**
 * Результат бронирования
 */
export interface BookingResult {
  bookingId: string;
  status: 'confirmed' | 'pending' | 'failed';
  confirmationNumber?: string;
  totalAmount: number;
  currency: string;
  expiresAt?: Date;
  cancellationPolicy?: string;
  documents?: string[];
}

/**
 * Результат отмены бронирования
 */
export interface CancelResult {
  success: boolean;
  refundAmount?: number;
  refundCurrency?: string;
  cancellationFee?: number;
  message?: string;
}

/**
 * Агрегированные результаты поиска
 */
export interface AggregatedResults<T extends BaseResult = BaseResult> {
  items: T[];
  providers: string[];
  totalCount: number;
  searchId: string;
  filters?: AvailableFilters;
  stats?: SearchStats;
}

/**
 * Доступные фильтры
 */
export interface AvailableFilters {
  priceRange?: {
    min: number;
    max: number;
  };
  stars?: number[];
  mealTypes?: string[];
  amenities?: string[];
  airlines?: string[];
  [key: string]: any;
}

/**
 * Статистика поиска
 */
export interface SearchStats {
  averagePrice: number;
  minPrice: number;
  maxPrice: number;
  totalProviders: number;
  successfulProviders: number;
  searchDuration: number;
}

/**
 * Конфигурация провайдера
 */
export interface ProviderConfig {
  name: string;
  type: ProviderType;
  priority: number;
  enabled: boolean;
  apiKey?: string;
  apiUrl?: string;
  timeout?: number;
  retryAttempts?: number;
  cacheTimeout?: number;
  rateLimit?: {
    requests: number;
    period: number; // в секундах
  };
}

/**
 * Метрики провайдера
 */
export interface ProviderMetrics {
  provider: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastError?: {
    message: string;
    timestamp: Date;
  };
  availability: number; // процент доступности
}