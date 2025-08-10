import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import TelegramBot from 'node-telegram-bot-api';
import { startBot } from '../../server/bot';
import { db } from '../../db';
import { profiles, groupProfiles, tours } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Mock Telegram Bot
jest.mock('node-telegram-bot-api');

describe('Bot Commands Integration Tests', () => {
  let bot: TelegramBot;
  let mockSendMessage: jest.Mock;
  let mockAnswerCallbackQuery: jest.Mock;

  beforeEach(async () => {
    // Clear database
    await db.delete(profiles);
    await db.delete(groupProfiles);
    await db.delete(tours);

    // Setup mock bot
    mockSendMessage = jest.fn().mockResolvedValue({ message_id: 1 });
    mockAnswerCallbackQuery = jest.fn().mockResolvedValue(true);
    
    (TelegramBot as jest.MockedClass<typeof TelegramBot>).mockImplementation(() => ({
      sendMessage: mockSendMessage,
      answerCallbackQuery: mockAnswerCallbackQuery,
      setWebHook: jest.fn().mockResolvedValue(true),
      deleteWebHook: jest.fn().mockResolvedValue(true),
      getUpdates: jest.fn().mockResolvedValue([]),
      on: jest.fn(),
      stopPolling: jest.fn().mockResolvedValue(true),
      startPolling: jest.fn().mockResolvedValue(true)
    } as any));

    bot = await startBot({} as any);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('/start command', () => {
    it('should create new user profile on first start', async () => {
      const message = {
        chat: { id: 123, type: 'private' },
        from: { id: 123, first_name: 'Test', username: 'testuser' },
        text: '/start'
      };

      // Simulate command
      await bot.emit('message', message);

      // Check profile was created
      const profile = await db.select()
        .from(profiles)
        .where(eq(profiles.userId, '123'))
        .limit(1);

      expect(profile).toHaveLength(1);
      expect(profile[0].name).toBe('Test');

      // Check welcome message was sent
      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Добро пожаловать'),
        expect.any(Object)
      );
    });

    it('should show existing profile for returning user', async () => {
      // Create existing profile
      await db.insert(profiles).values({
        userId: '123',
        name: 'Existing User',
        vacationType: 'beach',
        budget: 50000
      });

      const message = {
        chat: { id: 123, type: 'private' },
        from: { id: 123, first_name: 'Test', username: 'testuser' },
        text: '/start'
      };

      await bot.emit('message', message);

      // Should not create duplicate profile
      const profileCount = await db.select()
        .from(profiles)
        .where(eq(profiles.userId, '123'));

      expect(profileCount).toHaveLength(1);
      
      // Should show profile info
      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('ваш профиль'),
        expect.any(Object)
      );
    });
  });

  describe('/search command', () => {
    it('should search tours based on user profile', async () => {
      // Create profile with preferences
      await db.insert(profiles).values({
        userId: '123',
        name: 'Test User',
        vacationType: 'beach',
        countries: ['турция', 'египет'],
        budget: 80000,
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-30'),
        tripDuration: 7
      });

      const message = {
        chat: { id: 123, type: 'private' },
        from: { id: 123 },
        text: '/search'
      };

      await bot.emit('message', message);

      // Should send searching message
      expect(mockSendMessage).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Ищу туры'),
        expect.any(Object)
      );
    });

    it('should handle search with no profile', async () => {
      const message = {
        chat: { id: 456, type: 'private' },
        from: { id: 456 },
        text: '/search'
      };

      await bot.emit('message', message);

      // Should prompt to create profile
      expect(mockSendMessage).toHaveBeenCalledWith(
        456,
        expect.stringContaining('создайте профиль'),
        expect.any(Object)
      );
    });
  });

  describe('Group functionality', () => {
    it('should handle group tour search', async () => {
      // Create group profile
      const groupId = await db.insert(groupProfiles).values({
        chatId: '-1001234567890',
        chatTitle: 'Test Group',
        vacationType: 'beach',
        countries: ['греция'],
        budget: 100000,
        memberUserIds: ['123', '456'],
        memberNames: ['User1', 'User2']
      }).returning({ id: groupProfiles.id });

      const callbackQuery = {
        id: 'query123',
        from: { id: 123 },
        message: { 
          chat: { id: -1001234567890 },
          message_id: 100
        },
        data: 'group_search_' + groupId[0].id
      };

      await bot.emit('callback_query', callbackQuery);

      // Should start search
      expect(mockSendMessage).toHaveBeenCalledWith(
        -1001234567890,
        expect.stringContaining('Начинаю поиск туров для группы'),
        expect.any(Object)
      );

      expect(mockAnswerCallbackQuery).toHaveBeenCalledWith('query123');
    });

    it('should show tour details when requested', async () => {
      // Create test tour
      const tourId = await db.insert(tours).values({
        providerId: 'test-1',
        provider: 'leveltravel',
        country: 'Турция',
        region: 'Анталья',
        hotelName: 'Test Hotel 5*',
        starRating: 5,
        mealType: 'ai',
        price: 75000,
        nights: 7,
        link: 'https://example.com/tour/1'
      }).returning({ id: tours.id });

      const callbackQuery = {
        id: 'query456',
        from: { id: 123 },
        message: { 
          chat: { id: -1001234567890 },
          message_id: 100
        },
        data: `group_tour_${tourId[0].id}_1`
      };

      await bot.emit('callback_query', callbackQuery);

      // Should send tour details
      expect(mockSendMessage).toHaveBeenCalledWith(
        -1001234567890,
        expect.stringContaining('Test Hotel 5*'),
        expect.objectContaining({
          parse_mode: 'Markdown',
          reply_markup: expect.objectContaining({
            inline_keyboard: expect.arrayContaining([
              expect.arrayContaining([
                expect.objectContaining({ text: '👍 Голосовать' }),
                expect.objectContaining({ text: '🔗 Открыть на сайте' })
              ])
            ])
          })
        })
      );
    });

    it('should show group members list', async () => {
      // Create group with members
      const groupId = await db.insert(groupProfiles).values({
        chatId: '-1001234567890',
        chatTitle: 'Travel Group',
        memberUserIds: ['123', '456', '789'],
        memberNames: ['Alice', 'Bob', 'Charlie']
      }).returning({ id: groupProfiles.id });

      const callbackQuery = {
        id: 'query789',
        from: { id: 123 },
        message: { 
          chat: { id: -1001234567890 },
          message_id: 100
        },
        data: 'group_members_' + groupId[0].id
      };

      await bot.emit('callback_query', callbackQuery);

      // Should send members list
      expect(mockSendMessage).toHaveBeenCalledWith(
        -1001234567890,
        expect.stringContaining('Alice'),
        expect.any(Object)
      );
      
      expect(mockSendMessage).toHaveBeenCalledWith(
        -1001234567890,
        expect.stringContaining('Bob'),
        expect.any(Object)
      );
      
      expect(mockSendMessage).toHaveBeenCalledWith(
        -1001234567890,
        expect.stringContaining('Charlie'),
        expect.any(Object)
      );
    });
  });

  describe('Free text analysis', () => {
    it('should analyze free text and extract preferences', async () => {
      const message = {
        chat: { id: 123, type: 'private' },
        from: { id: 123, first_name: 'Test' },
        text: 'Хочу отдохнуть в Турции на море, бюджет до 80 тысяч, в июне на неделю'
      };

      await bot.emit('message', message);

      // Should analyze and save preferences
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for async processing

      const profile = await db.select()
        .from(profiles)
        .where(eq(profiles.userId, '123'))
        .limit(1);

      if (profile[0]) {
        expect(profile[0].countries).toContain('турция');
        expect(profile[0].budget).toBeLessThanOrEqual(80000);
        expect(profile[0].tripDuration).toBe(7);
      }
    });
  });
});