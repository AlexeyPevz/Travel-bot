import { jest } from '@jest/globals';
import axios from 'axios';
import { analyzeTourRequest, calculateTourMatchScore } from '../../server/services/openrouter';

// Мокаем axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Мокаем логгер
jest.mock('../../server/utils/logger', () => ({
  aiLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('OpenRouter Service with Fallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Очищаем переменные окружения
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.YANDEX_GPT_API_KEY;
  });

  describe('analyzeTourRequest with fallback chain', () => {
    const testMessage = 'Хочу в Турцию на море, 5 звезд, все включено, бюджет 200к на двоих';
    
    const expectedResult = {
      vacationType: 'beach',
      countries: ['Турция'],
      budget: 200000,
      peopleCount: 2,
      priorities: {
        starRating: 10,
        beachLine: 10,
        mealType: 9,
        hotelRating: 7,
        priceValue: 6
      }
    };

    it('should use OpenRouter when API key is provided', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: JSON.stringify(expectedResult)
            }
          }]
        }
      });

      const result = await analyzeTourRequest(testMessage);
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://openrouter.ai/api/v1/chat/completions',
        expect.objectContaining({
          model: expect.any(String),
          messages: expect.any(Array),
          temperature: 0.3,
          max_tokens: 500,
          response_format: { type: 'json_object' }
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-openrouter-key'
          })
        })
      );
      
      expect(result).toEqual(expectedResult);
    });

    it('should fallback to next OpenRouter model if first fails', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      
      // Первая модель падает
      mockedAxios.post.mockRejectedValueOnce(new Error('Model not available'));
      
      // Вторая модель работает
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: JSON.stringify(expectedResult)
            }
          }]
        }
      });

      const result = await analyzeTourRequest(testMessage);
      
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      expect(result).toEqual(expectedResult);
    });

    it('should fallback to YandexGPT when OpenRouter fails', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.YANDEX_GPT_API_KEY = 'test-yandex-key';
      
      // OpenRouter падает
      mockedAxios.post.mockRejectedValue(new Error('OpenRouter service unavailable'));
      
      // Мокаем успешный ответ для всех 5 моделей OpenRouter и затем YandexGPT
      for (let i = 0; i < 5; i++) {
        mockedAxios.post.mockRejectedValueOnce(new Error('Model failed'));
      }
      
      // YandexGPT работает
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          result: {
            alternatives: [{
              message: {
                text: JSON.stringify(expectedResult)
              }
            }]
          }
        }
      });

      const result = await analyzeTourRequest(testMessage);
      
      // Должно быть 6 вызовов: 5 для OpenRouter моделей + 1 для YandexGPT
      expect(mockedAxios.post).toHaveBeenCalledTimes(6);
      
      // Проверяем что последний вызов был к YandexGPT
      expect(mockedAxios.post).toHaveBeenLastCalledWith(
        'https://llm.api.cloud.yandex.net/foundationModels/v1/completion',
        expect.objectContaining({
          modelUri: expect.stringContaining('yandexgpt-lite'),
          completionOptions: expect.any(Object),
          messages: expect.any(Array)
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-yandex-key'
          })
        })
      );
      
      expect(result).toEqual(expectedResult);
    });

    it('should fallback to basic parsing when all AI providers fail', async () => {
      process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
      process.env.YANDEX_GPT_API_KEY = 'test-yandex-key';
      
      // Все провайдеры падают
      mockedAxios.post.mockRejectedValue(new Error('All services down'));

      const result = await analyzeTourRequest(testMessage);
      
      // Проверяем что использовался базовый парсинг
      expect(result).toMatchObject({
        countries: ['Турция'],
        budget: 200000,
        peopleCount: 2,
        vacationType: 'beach',
        priorities: expect.objectContaining({
          starRating: 8, // 5 звезд => высокий приоритет
          mealType: 9, // все включено => высокий приоритет
          beachLine: 10 // море => высокий приоритет для пляжа
        })
      });
    });

    it('should use basic parsing when no API keys provided', async () => {
      const result = await analyzeTourRequest(testMessage);
      
      expect(mockedAxios.post).not.toHaveBeenCalled();
      
      expect(result).toMatchObject({
        countries: ['Турция'],
        budget: 200000,
        peopleCount: 2,
        vacationType: 'beach'
      });
    });

    it('should handle invalid JSON response gracefully', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: 'Invalid JSON response'
            }
          }]
        }
      });

      const result = await analyzeTourRequest(testMessage);
      
      // Должен использовать базовый парсинг
      expect(result).toMatchObject({
        countries: ['Турция'],
        budget: 200000,
        vacationType: 'beach'
      });
    });
  });

  describe('calculateTourMatchScore with AI analysis', () => {
    const mockTour = {
      title: 'Rixos Premium Belek',
      country: 'Турция',
      hotelName: 'Rixos Premium Belek',
      starRating: 5,
      beachLine: 1,
      mealType: 'ВСЁ ВКЛЮЧЕНО - All Inclusive',
      price: 180000,
      hotelRating: 9.2
    };

    const mockPreferences = {
      countries: ['Турция'],
      budget: 200000,
      vacationType: 'beach'
    };

    const mockPriorities = {
      starRating: 9,
      beachLine: 10,
      mealType: 9,
      hotelRating: 7,
      price: 8
    };

    it('should calculate match score with AI analysis', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          choices: [{
            message: {
              content: 'Отличный выбор для пляжного отдыха: 5*, первая линия, все включено в рамках бюджета.'
            }
          }]
        }
      });

      const result = await calculateTourMatchScore(mockTour, mockPreferences, mockPriorities);
      
      expect(result.score).toBeGreaterThan(80); // Высокое соответствие
      expect(result.details).toMatchObject({
        starRating: 100, // 5* отель
        beachLine: 100, // Первая линия
        mealType: 100, // Все включено
        price: expect.any(Number),
        hotelRating: 92, // 9.2 из 10
        location: 100 // Турция в списке стран
      });
      expect(result.analysis).toContain('Отличный выбор');
    });

    it('should work without AI providers', async () => {
      const result = await calculateTourMatchScore(mockTour, mockPreferences, mockPriorities);
      
      expect(result.score).toBeGreaterThan(80);
      expect(result.analysis).toMatch(/Тур соответствует вашим критериям на \d+%/);
    });
  });
});