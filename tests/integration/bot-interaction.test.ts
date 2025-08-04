import TelegramBot from 'node-telegram-bot-api';
import { handleCommand, handleTextMessage } from '../../server/bot/handlers';
import { getUserState, setUserState, resetUserState, FSM_STATES } from '../../server/bot/fsm';
import { db } from '../../db';
import { profiles, travelRequests } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { searchTours } from '../../server/providers';

// Mock Telegram Bot
jest.mock('node-telegram-bot-api');
jest.mock('../../server/providers');

describe('Bot Interaction Integration', () => {
  let bot: jest.Mocked<TelegramBot>;
  const chatId = 123456789;
  const userId = 'bot-integration-test';

  beforeEach(async () => {
    bot = {
      sendMessage: jest.fn().mockResolvedValue({}),
      sendPhoto: jest.fn().mockResolvedValue({}),
      sendMediaGroup: jest.fn().mockResolvedValue({}),
      setMyCommands: jest.fn().mockResolvedValue({}),
    } as any;

    // Clean up test data
    await db.delete(travelRequests).where(eq(travelRequests.userId, userId));
    await db.delete(profiles).where(eq(profiles.userId, userId));
    await resetUserState(userId);
    
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await db.delete(travelRequests).where(eq(travelRequests.userId, userId));
    await db.delete(profiles).where(eq(profiles.userId, userId));
  });

  describe('Complete Bot Onboarding Flow', () => {
    it('should guide new user through complete onboarding', async () => {
      // Step 1: Start command
      await handleCommand(bot, chatId, userId, '/start');
      
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Добро пожаловать'),
        expect.any(Object)
      );

      // Verify state changed to onboarding
      const state1 = await getUserState(userId);
      expect(state1.state).toBe(FSM_STATES.ONBOARDING_NAME);

      // Step 2: Provide name
      await handleTextMessage(bot, chatId, userId, 'Александр');
      
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('стиль путешествий'),
        expect.any(Object)
      );

      // Step 3: Select travel style
      await setUserState(userId, FSM_STATES.ONBOARDING_TRAVEL_STYLE, { name: 'Александр' });
      await handleTextMessage(bot, chatId, userId, 'Комфорт');

      // Step 4: Select interests
      await setUserState(userId, FSM_STATES.ONBOARDING_INTERESTS, { 
        name: 'Александр',
        travelStyle: 'comfort' 
      });
      await handleTextMessage(bot, chatId, userId, 'Пляжи, культура, еда');

      // Verify profile was created
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId));

      expect(profile).toBeTruthy();
      expect(profile.name).toBe('Александр');
      expect(profile.travelStyle).toBe('comfort');
    });
  });

  describe('Tour Search Flow via Bot', () => {
    beforeEach(async () => {
      // Create test profile
      await db.insert(profiles).values({
        userId,
        username: 'testuser',
        name: 'Test User',
        travelStyle: 'budget',
        interests: ['beach'],
        budget: { min: 30000, max: 50000 },
        preferences: {},
      });

      // Mock tour search
      (searchTours as jest.Mock).mockResolvedValue([
        {
          id: 'tour-123',
          title: 'Отель в Турции',
          price: 45000,
          hotelName: 'Test Hotel',
          hotelRating: 4,
          destination: 'Турция',
          startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000),
        },
      ]);
    });

    it('should handle complete tour search flow', async () => {
      // Step 1: User sends free-text search request
      await handleTextMessage(bot, chatId, userId, 'Хочу в Турцию на неделю в следующем месяце, бюджет 50 тысяч');

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Анализирую ваш запрос'),
        expect.any(Object)
      );

      // Simulate state progression
      await setUserState(userId, FSM_STATES.SEARCHING, {
        destination: 'Турция',
        duration: 7,
        budget: { min: 40000, max: 60000 },
      });

      // Verify search was initiated
      expect(searchTours).toHaveBeenCalled();

      // Bot should send tour results
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('нашел'),
        expect.any(Object)
      );
    });

    it('should handle step-by-step tour search', async () => {
      // Start search command
      await handleTextMessage(bot, chatId, userId, 'Найти тур');
      
      // Set destination
      await setUserState(userId, FSM_STATES.WAITING_DESTINATION);
      await handleTextMessage(bot, chatId, userId, 'Египет');

      const state = await getUserState(userId);
      expect(state.data.destination).toBe('Египет');

      // Set dates
      await setUserState(userId, FSM_STATES.WAITING_DATES, state.data);
      await handleTextMessage(bot, chatId, userId, 'с 15 июня по 22 июня');

      // Set guests
      await setUserState(userId, FSM_STATES.WAITING_GUESTS, state.data);
      await handleTextMessage(bot, chatId, userId, '2 взрослых');

      // Set budget
      await setUserState(userId, FSM_STATES.WAITING_BUDGET, state.data);
      await handleTextMessage(bot, chatId, userId, '80000 рублей');

      // Verify all data collected
      const finalState = await getUserState(userId);
      expect(finalState.data).toMatchObject({
        destination: 'Египет',
        adults: 2,
        budget: expect.any(Object),
      });
    });
  });

  describe('Error Handling in Bot Flow', () => {
    it('should recover from errors gracefully', async () => {
      // Simulate database error
      jest.spyOn(db, 'select').mockRejectedValueOnce(new Error('DB Error'));

      await handleCommand(bot, chatId, userId, '/start');

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('ошибка'),
        expect.any(Object)
      );

      // Bot should still be functional after error
      jest.spyOn(db, 'select').mockRestore();
      await handleCommand(bot, chatId, userId, '/help');

      expect(bot.sendMessage).toHaveBeenLastCalledWith(
        chatId,
        expect.stringContaining('Доступные команды'),
        expect.any(Object)
      );
    });

    it('should handle invalid user input', async () => {
      // Set state waiting for dates
      await setUserState(userId, FSM_STATES.WAITING_DATES, { destination: 'Turkey' });

      // Send invalid date
      await handleTextMessage(bot, chatId, userId, 'завтра-послезавтра-потом');

      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('не смог распознать даты'),
        expect.any(Object)
      );

      // User should still be in same state
      const state = await getUserState(userId);
      expect(state.state).toBe(FSM_STATES.WAITING_DATES);
    });
  });

  describe('Concurrent Bot Interactions', () => {
    it('should handle multiple users simultaneously', async () => {
      const users = Array.from({ length: 5 }, (_, i) => ({
        userId: `concurrent-user-${i}`,
        chatId: 100000 + i,
      }));

      // All users start simultaneously
      const startPromises = users.map(user => 
        handleCommand(bot, user.chatId, user.userId, '/start')
      );

      await Promise.all(startPromises);

      // Each user should get their own message
      expect(bot.sendMessage).toHaveBeenCalledTimes(5);

      // Verify each user has their own state
      const statePromises = users.map(user => getUserState(user.userId));
      const states = await Promise.all(statePromises);

      states.forEach(state => {
        expect(state.state).toBe(FSM_STATES.ONBOARDING_NAME);
      });
    });
  });
});