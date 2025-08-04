import TelegramBot from 'node-telegram-bot-api';
import { handleCommand, handleTextMessage } from '../../server/bot/handlers';
import { getUserState, setUserState, FSM_STATES } from '../../server/bot/fsm';
import { db } from '../../db';
import { profiles } from '@shared/schema';

// Mock dependencies
jest.mock('node-telegram-bot-api');
jest.mock('../../server/bot/fsm');
jest.mock('../../db', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockReturnThis(),
  },
}));

describe('Bot Handlers', () => {
  let bot: jest.Mocked<TelegramBot>;
  const chatId = 123456;
  const userId = 'user123';

  beforeEach(() => {
    bot = {
      sendMessage: jest.fn(),
      sendPhoto: jest.fn(),
      sendDocument: jest.fn(),
      sendMediaGroup: jest.fn(),
    } as any;
    
    jest.clearAllMocks();
  });

  describe('handleCommand', () => {
    describe('/start command', () => {
      it('should send welcome message for new user', async () => {
        (db.select as jest.Mock).mockResolvedValue([]);
        
        await handleCommand(bot, chatId, userId, '/start');
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining('Добро пожаловать'),
          expect.any(Object)
        );
      });

      it('should handle referral code', async () => {
        (db.select as jest.Mock).mockResolvedValue([]);
        
        await handleCommand(bot, chatId, userId, '/start ref123');
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining('реферальной ссылке'),
          expect.any(Object)
        );
      });

      it('should show different message for existing user', async () => {
        (db.select as jest.Mock).mockResolvedValue([{
          userId,
          name: 'John',
          travelStyle: 'comfort',
        }]);
        
        await handleCommand(bot, chatId, userId, '/start');
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining('С возвращением'),
          expect.any(Object)
        );
      });
    });

    describe('/help command', () => {
      it('should send help message with available commands', async () => {
        await handleCommand(bot, chatId, userId, '/help');
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining('Доступные команды'),
          expect.objectContaining({
            parse_mode: 'Markdown',
          })
        );
      });
    });

    describe('/myrequests command', () => {
      it('should show active requests', async () => {
        await handleCommand(bot, chatId, userId, '/myrequests');
        
        expect(bot.sendMessage).toHaveBeenCalled();
        const message = bot.sendMessage.mock.calls[0][1];
        expect(message).toContain('запрос');
      });
    });

    describe('/referral command', () => {
      it('should generate referral link', async () => {
        await handleCommand(bot, chatId, userId, '/referral');
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining('реферальная ссылка'),
          expect.any(Object)
        );
      });
    });

    describe('unknown command', () => {
      it('should send error message for unknown command', async () => {
        await handleCommand(bot, chatId, userId, '/unknown');
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          'Неизвестная команда. Используйте /start для начала работы.'
        );
      });
    });
  });

  describe('handleTextMessage', () => {
    describe('State: IDLE', () => {
      beforeEach(() => {
        (getUserState as jest.Mock).mockResolvedValue({
          state: FSM_STATES.IDLE,
          data: {},
        });
      });

      it('should analyze free text tour request', async () => {
        await handleTextMessage(bot, chatId, userId, 'Хочу в Египет на море в августе');
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining('Анализирую ваш запрос'),
          expect.any(Object)
        );
      });
    });

    describe('State: WAITING_DESTINATION', () => {
      beforeEach(() => {
        (getUserState as jest.Mock).mockResolvedValue({
          state: FSM_STATES.WAITING_DESTINATION,
          data: {},
        });
      });

      it('should save destination and ask for dates', async () => {
        await handleTextMessage(bot, chatId, userId, 'Турция');
        
        expect(setUserState).toHaveBeenCalledWith(
          userId,
          FSM_STATES.WAITING_DATES,
          { destination: 'Турция' }
        );
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining('даты поездки'),
          expect.any(Object)
        );
      });
    });

    describe('State: WAITING_DATES', () => {
      beforeEach(() => {
        (getUserState as jest.Mock).mockResolvedValue({
          state: FSM_STATES.WAITING_DATES,
          data: { destination: 'Greece' },
        });
      });

      it('should parse dates and ask for guests', async () => {
        await handleTextMessage(bot, chatId, userId, 'с 15 по 22 июня');
        
        expect(setUserState).toHaveBeenCalledWith(
          userId,
          FSM_STATES.WAITING_GUESTS,
          expect.objectContaining({
            startDate: expect.any(String),
            endDate: expect.any(String),
          })
        );
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining('Сколько человек'),
          expect.any(Object)
        );
      });

      it('should handle invalid date format', async () => {
        await handleTextMessage(bot, chatId, userId, 'неправильная дата');
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining('не смог распознать даты'),
          expect.any(Object)
        );
      });
    });

    describe('State: WAITING_BUDGET', () => {
      beforeEach(() => {
        (getUserState as jest.Mock).mockResolvedValue({
          state: FSM_STATES.WAITING_BUDGET,
          data: {
            destination: 'Turkey',
            startDate: '2024-06-15',
            endDate: '2024-06-22',
            adults: 2,
          },
        });
      });

      it('should parse budget range', async () => {
        await handleTextMessage(bot, chatId, userId, 'от 50000 до 80000');
        
        expect(setUserState).toHaveBeenCalledWith(
          userId,
          FSM_STATES.WAITING_PREFERENCES,
          expect.objectContaining({
            budget: { min: 50000, max: 80000 },
          })
        );
      });

      it('should handle single budget value', async () => {
        await handleTextMessage(bot, chatId, userId, '60000 рублей');
        
        expect(setUserState).toHaveBeenCalledWith(
          userId,
          FSM_STATES.WAITING_PREFERENCES,
          expect.objectContaining({
            budget: { min: 48000, max: 72000 }, // ±20%
          })
        );
      });
    });

    describe('State: ONBOARDING_NAME', () => {
      beforeEach(() => {
        (getUserState as jest.Mock).mockResolvedValue({
          state: FSM_STATES.ONBOARDING_NAME,
          data: {},
        });
      });

      it('should save name and proceed to travel style', async () => {
        await handleTextMessage(bot, chatId, userId, 'Александр');
        
        expect(setUserState).toHaveBeenCalledWith(
          userId,
          FSM_STATES.ONBOARDING_TRAVEL_STYLE,
          { name: 'Александр' }
        );
        
        expect(bot.sendMessage).toHaveBeenCalledWith(
          chatId,
          expect.stringContaining('стиль путешествий'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle command errors gracefully', async () => {
      (db.select as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      await handleCommand(bot, chatId, userId, '/start');
      
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        'Произошла ошибка при обработке команды. Пожалуйста, попробуйте еще раз.'
      );
    });

    it('should handle message errors gracefully', async () => {
      (getUserState as jest.Mock).mockRejectedValue(new Error('State error'));
      
      await handleTextMessage(bot, chatId, userId, 'test message');
      
      expect(bot.sendMessage).toHaveBeenCalledWith(
        chatId,
        expect.stringContaining('Произошла ошибка')
      );
    });
  });
});