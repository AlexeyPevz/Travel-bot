import { Profile } from '@shared/schema';

// Finite State Machine states for bot conversation
export enum FSM_STATES {
  IDLE = 'idle',
  
  // Состояния для онбординга
  WAITING_NAME = 'waiting_name',
  WAITING_VACATION_TYPE = 'waiting_vacation_type',
  WAITING_COUNTRIES = 'waiting_countries',
  WAITING_BUDGET = 'waiting_budget',
  WAITING_DATES = 'waiting_dates',
  WAITING_DURATION = 'waiting_duration',
  WAITING_TRAVELERS = 'waiting_travelers',
  WAITING_PREFERENCES = 'waiting_preferences',
  
  // Состояния для поиска туров
  SEARCH_WAITING_DEPARTURE_CITY = 'search_waiting_departure_city',
  SEARCH_WAITING_ADULTS_COUNT = 'search_waiting_adults_count',
  SEARCH_WAITING_CHILDREN_INFO = 'search_waiting_children_info',
  SEARCH_WAITING_CHILDREN_COUNT = 'search_waiting_children_count',
  SEARCH_WAITING_CHILDREN_AGES = 'search_waiting_children_ages',
  SEARCH_CONFIRMING_PARAMS = 'search_confirming_params'
}

// Параметры поиска тура
export interface TourSearchData {
  // Из анализа текста
  destination?: string;
  countries?: string[];
  budget?: number;
  dateType?: 'fixed' | 'flexible';
  startDate?: Date;
  endDate?: Date;
  flexibleMonth?: string;
  tripDuration?: number;
  vacationType?: string;
  priorities?: any;
  
  // Обязательные параметры для API
  departureCity?: string;
  adultsCount?: number;
  childrenCount?: number;
  childrenAges?: number[];
  
  // Дополнительные параметры
  hotelStars?: number[];
  mealType?: string;
  beachLine?: number;
}

// User state type
interface UserState {
  state: FSM_STATES;
  profile: Partial<Profile>;
  onboardingShown?: boolean; // Флаг, показывающий, был ли показан онбординг
  searchData?: TourSearchData; // Данные для поиска туров
  [key: string]: any; // Additional dynamic properties
}

// Storage for user states
const userStates = new Map<string, UserState>();

/**
 * Get user state
 * @param userId Telegram user ID
 * @returns User state or null if not found
 */
export function getUserState(userId: string): UserState | null {
  return userStates.get(userId) || null;
}

/**
 * Set user state
 * @param userId Telegram user ID
 * @param state New user state
 */
export function setUserState(userId: string, state: UserState): void {
  userStates.set(userId, state);
}

/**
 * Reset user state
 * @param userId Telegram user ID
 */
export function resetUserState(userId: string): void {
  userStates.set(userId, {
    state: FSM_STATES.IDLE,
    profile: { userId },
    onboardingShown: false // По умолчанию онбординг не показан
  });
}

/**
 * Update user state profile
 * @param userId Telegram user ID
 * @param profileUpdate Partial profile to update
 */
export function updateUserStateProfile(userId: string, profileUpdate: Partial<Profile>): void {
  const state = getUserState(userId);
  
  if (state) {
    setUserState(userId, {
      ...state,
      profile: {
        ...state.profile,
        ...profileUpdate
      }
    });
  }
}

/**
 * Update tour search data
 * @param userId Telegram user ID
 * @param searchDataUpdate Partial search data to update
 */
export function updateSearchData(userId: string, searchDataUpdate: Partial<TourSearchData>): void {
  const state = getUserState(userId);
  
  if (state) {
    setUserState(userId, {
      ...state,
      searchData: {
        ...state.searchData,
        ...searchDataUpdate
      }
    });
  }
}
