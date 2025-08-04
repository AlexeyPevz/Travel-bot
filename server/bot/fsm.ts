import { Profile } from '@shared/schema';

// Finite State Machine states for bot conversation
export enum FSM_STATES {
  IDLE = 'idle',
  WAITING_NAME = 'waiting_name',
  WAITING_VACATION_TYPE = 'waiting_vacation_type',
  WAITING_COUNTRIES = 'waiting_countries',
  WAITING_DESTINATION = 'waiting_destination',
  WAITING_DATE_TYPE = 'waiting_date_type',
  WAITING_FIXED_START_DATE = 'waiting_fixed_start_date',
  WAITING_FIXED_END_DATE = 'waiting_fixed_end_date',
  WAITING_FLEXIBLE_MONTH = 'waiting_flexible_month',
  WAITING_TRIP_DURATION = 'waiting_trip_duration',
  WAITING_BUDGET = 'waiting_budget',
  WAITING_PRIORITIES = 'waiting_priorities',
  WAITING_DEADLINE = 'waiting_deadline'
}

// User state type
interface UserState {
  state: FSM_STATES;
  profile: Partial<Profile>;
  onboardingShown?: boolean; // Флаг, показывающий, был ли показан онбординг
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
