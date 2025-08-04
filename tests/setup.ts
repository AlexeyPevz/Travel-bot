// Setup test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/tourtinder_test';
process.env.TELEGRAM_TOKEN = 'test_token';
process.env.OPENROUTER_API_KEY = 'test_api_key';
process.env.LEVELTRAVEL_API_KEY = 'test_leveltravel_key';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.LOG_LEVEL = 'error';

// Mock Telegram Bot
jest.mock('node-telegram-bot-api');

// Mock Redis to avoid actual connections in tests
jest.mock('ioredis', () => {
  const Redis = jest.requireActual('ioredis-mock');
  return Redis;
});

// Global test utilities
global.testHelpers = {
  generateUserId: () => Math.floor(Math.random() * 1000000).toString(),
  generateChatId: () => '-' + Math.floor(Math.random() * 1000000000).toString(),
};