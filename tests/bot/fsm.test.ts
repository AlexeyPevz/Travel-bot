import { getUserState, setUserState, resetUserState, FSM_STATES } from '../../server/bot/fsm';
import { storage } from '../../server/storage';

// Mock storage
jest.mock('../../server/storage', () => ({
  storage: {
    get: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('FSM (Finite State Machine)', () => {
  const mockUserId = 'test-user-123';
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserState', () => {
    it('should return current user state', async () => {
      const mockState = {
        state: FSM_STATES.WAITING_TRAVEL_STYLE,
        data: { destination: 'Egypt' },
      };
      
      (storage.get as jest.Mock).mockResolvedValue(mockState);
      
      const state = await getUserState(mockUserId);
      
      expect(storage.get).toHaveBeenCalledWith(`user_state:${mockUserId}`);
      expect(state).toEqual(mockState);
    });

    it('should return IDLE state if no state exists', async () => {
      (storage.get as jest.Mock).mockResolvedValue(null);
      
      const state = await getUserState(mockUserId);
      
      expect(state).toEqual({
        state: FSM_STATES.IDLE,
        data: {},
      });
    });
  });

  describe('setUserState', () => {
    it('should set user state with data', async () => {
      const newState = FSM_STATES.WAITING_DESTINATION;
      const data = { query: 'Beach vacation' };
      
      await setUserState(mockUserId, newState, data);
      
      expect(storage.set).toHaveBeenCalledWith(
        `user_state:${mockUserId}`,
        { state: newState, data },
        3600 // 1 hour TTL
      );
    });

    it('should merge with existing data when updating state', async () => {
      const existingData = { destination: 'Turkey' };
      const newData = { budget: 2000 };
      
      (storage.get as jest.Mock).mockResolvedValue({
        state: FSM_STATES.WAITING_BUDGET,
        data: existingData,
      });
      
      await setUserState(mockUserId, FSM_STATES.WAITING_DATES, newData);
      
      expect(storage.set).toHaveBeenCalledWith(
        `user_state:${mockUserId}`,
        {
          state: FSM_STATES.WAITING_DATES,
          data: { ...existingData, ...newData },
        },
        3600
      );
    });
  });

  describe('resetUserState', () => {
    it('should delete user state', async () => {
      await resetUserState(mockUserId);
      
      expect(storage.delete).toHaveBeenCalledWith(`user_state:${mockUserId}`);
    });
  });

  describe('FSM State Transitions', () => {
    it('should have all required states', () => {
      expect(FSM_STATES).toMatchObject({
        IDLE: expect.any(String),
        WAITING_DESTINATION: expect.any(String),
        WAITING_DATES: expect.any(String),
        WAITING_GUESTS: expect.any(String),
        WAITING_BUDGET: expect.any(String),
        WAITING_PREFERENCES: expect.any(String),
        WAITING_TRAVEL_STYLE: expect.any(String),
        SEARCHING: expect.any(String),
        ONBOARDING_NAME: expect.any(String),
        ONBOARDING_TRAVEL_STYLE: expect.any(String),
        ONBOARDING_INTERESTS: expect.any(String),
        GROUP_SETUP_WAITING_NAME: expect.any(String),
        GROUP_SETUP_WAITING_DESCRIPTION: expect.any(String),
        GROUP_SETUP_WAITING_PREFERENCES: expect.any(String),
      });
    });
  });

  describe('State Flow Integration', () => {
    it('should handle complete onboarding flow', async () => {
      // Start onboarding
      await setUserState(mockUserId, FSM_STATES.ONBOARDING_NAME);
      expect(storage.set).toHaveBeenCalledWith(
        `user_state:${mockUserId}`,
        { state: FSM_STATES.ONBOARDING_NAME, data: {} },
        3600
      );

      // Set name
      await setUserState(mockUserId, FSM_STATES.ONBOARDING_TRAVEL_STYLE, { name: 'John' });
      
      // Set travel style
      await setUserState(mockUserId, FSM_STATES.ONBOARDING_INTERESTS, { 
        name: 'John',
        travelStyle: 'comfort' 
      });
      
      // Complete onboarding
      await setUserState(mockUserId, FSM_STATES.IDLE, {
        name: 'John',
        travelStyle: 'comfort',
        interests: ['beach', 'culture']
      });
    });

    it('should handle tour search flow', async () => {
      // Start search
      await setUserState(mockUserId, FSM_STATES.WAITING_DESTINATION);
      
      // Set destination
      (storage.get as jest.Mock).mockResolvedValue({
        state: FSM_STATES.WAITING_DESTINATION,
        data: {},
      });
      await setUserState(mockUserId, FSM_STATES.WAITING_DATES, { destination: 'Greece' });
      
      // Set dates
      (storage.get as jest.Mock).mockResolvedValue({
        state: FSM_STATES.WAITING_DATES,
        data: { destination: 'Greece' },
      });
      await setUserState(mockUserId, FSM_STATES.WAITING_GUESTS, { 
        startDate: '2024-06-01',
        endDate: '2024-06-08'
      });
      
      // Continue flow...
      expect(storage.set).toHaveBeenCalledTimes(3);
    });
  });
});