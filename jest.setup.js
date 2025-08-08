// Basic test setup
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';
process.env.JWT_ISSUER = 'test-issuer';
process.env.JWT_AUDIENCE = 'test-audience';
process.env.OPENROUTER_API_KEY = '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';
process.env.YANDEX_GPT_API_KEY = 'test-yandex-key';
process.env.TELEGRAM_TOKEN = '7572354182:AAHQCp0wVzKbn4SLQqYePuSKAVcmpjcfHyY';
process.env.LEVELTRAVEL_API_KEY = '2b30a8c3b829c298fd3e7e2b03657213';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';

// Add custom matchers if needed
// Will be added back after basic tests work
/*
expect.extend({
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
});
*/