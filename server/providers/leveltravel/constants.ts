/**
 * Level.Travel API Constants
 */

export const LEVEL_TRAVEL_API_URL = "https://api.level.travel";
export const LEVEL_TRAVEL_PARTNER_ID = process.env.LEVEL_TRAVEL_PARTNER || '627387';
export const LEVEL_TRAVEL_REFERRAL_URL = `https://level.travel/?ref=${LEVEL_TRAVEL_PARTNER_ID}`;

/**
 * Country codes mapping for Level.Travel API
 */
export const COUNTRY_CODES: Record<string, string> = {
  'турция': 'TR',
  'египет': 'EG',
  'кипр': 'CY',
  'оаэ': 'AE',
  'таиланд': 'TH',
  'индонезия': 'ID',
  'тунис': 'TN',
  'греция': 'GR',
  'испания': 'ES',
  'италия': 'IT',
  'мальдивы': 'MV',
  'танзания': 'TZ',
  'доминикана': 'DO',
  'мексика': 'MX',
  'куба': 'CU',
  'россия': 'RU',
  'абхазия': 'ABH'
};

/**
 * Meal type mapping for Level.Travel API
 */
export const MEAL_TYPES: Record<string, string> = {
  // Специальные форматы для лучшей сортировки
  'ro': 'НЕТ - Без питания',
  'bb': 'ЗАВТРАК - Только завтрак (Bed & Breakfast)',
  'hb': 'ПОЛУПАНСИОН - Завтрак и ужин (Half Board)',
  'fb': 'ПОЛНЫЙ ПАНСИОН - Завтрак, обед и ужин (Full Board)',
  'ai': 'ВСЁ ВКЛЮЧЕНО - All Inclusive',
  'uai': 'УЛЬТРА ВСЁ ВКЛЮЧЕНО - Ultra All Inclusive',
  
  // Дополнительные вариации названий
  'non': 'НЕТ - Без питания',
  'no_meals': 'НЕТ - Без питания',
  'breakfast': 'ЗАВТРАК - Только завтрак',
  'half_board': 'ПОЛУПАНСИОН - Завтрак и ужин',
  'full_board': 'ПОЛНЫЙ ПАНСИОН - Завтрак, обед и ужин',
  'all_inclusive': 'ВСЁ ВКЛЮЧЕНО - All Inclusive',
  'ultra_all_inclusive': 'УЛЬТРА ВСЁ ВКЛЮЧЕНО - Ultra All Inclusive'
};

/**
 * Beach line mapping
 */
export const BEACH_LINES: Record<number, string> = {
  1: 'Первая линия',
  2: 'Вторая линия',
  3: 'Третья линия',
  4: 'Четвертая линия и далее'
};

/**
 * API Endpoints
 */
export const ENDPOINTS = {
  SEARCH_FORM: '/search_form',
  SEARCH_HOTELS: '/search_hotels',
  SEARCH_TOURS: '/hot_tours',
  SEARCH_FLIGHTS: '/flights/search',
  GET_HOTEL: '/hotels',
  REFERENCES: '/references',
  COUNTRIES: '/references/countries',
  DEPARTURE_CITIES: '/references/departure_cities',
  DESTINATIONS: '/references/destinations',
  HOTEL_DUMP: '/hotel_dump'
};

/**
 * Request timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  SEARCH: 30000, // 30 seconds
  REFERENCES: 10000, // 10 seconds
  DEFAULT: 15000 // 15 seconds
};

/**
 * Cache TTL (in seconds)
 */
export const CACHE_TTL = {
  SEARCH_RESULTS: 300, // 5 minutes
  REFERENCES: 3600, // 1 hour
  HOTEL_INFO: 1800 // 30 minutes
};

/**
 * Rate limiting
 */
export const RATE_LIMITS = {
  REQUESTS_PER_SECOND: 5,
  BURST_SIZE: 10
};