import { jest } from '@jest/globals';

// Setup test environment
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/tourtinder_test';
process.env.TELEGRAM_TOKEN = 'test_token';
process.env.OPENROUTER_API_KEY = 'test_api_key';
process.env.LEVELTRAVEL_API_KEY = 'test_leveltravel_key';
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.REDIS_PASSWORD = '';
process.env.LOG_LEVEL = 'error';
process.env.CSRF_SECRET = 'test_csrf_secret_min_32_characters';
process.env.COOKIE_SECRET = 'test_cookie_secret_min_32_characters';
process.env.SESSION_SECRET = 'test_session_secret_min_32_characters';
process.env.APP_URL = 'http://localhost:5000';
process.env.LEVEL_TRAVEL_PARTNER = '123456';
process.env.LEVEL_TRAVEL_MARKER = 'marker';
process.env.LEVEL_TRAVEL_AFFILIATE_URL = 'https://example.com/aff';

// Mock Telegram Bot
jest.mock('node-telegram-bot-api');

// Mock Redis to avoid actual connections in tests
jest.mock('ioredis', () => {
  const Redis = jest.requireActual('ioredis-mock');
  return Redis;
});

// Extend global type
declare global {
  var testHelpers: {
    generateUserId: () => string;
    generateChatId: () => string;
  };
}

// Global test utilities
global.testHelpers = {
  generateUserId: () => Math.floor(Math.random() * 1000000).toString(),
  generateChatId: () => '-' + Math.floor(Math.random() * 1000000000).toString(),
};