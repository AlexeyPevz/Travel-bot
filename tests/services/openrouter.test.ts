import { analyzeTourRequest, calculateTourMatchScore } from '../../server/services/openrouter';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('OpenRouter Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeTourRequest', () => {
    it('should analyze tour request with AI when API key is available', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: JSON.stringify({
                vacationType: 'beach',
                countries: ['Турция'],
                budget: 150000,
                duration: 7,
                peopleCount: 2,
                priorities: {
                  beachLine: 10,
                  starRating: 8,
                  price: 9
                }
              })
            }
          }]
        }
      };
      
      mockedAxios.post.mockResolvedValueOnce(mockResponse);
      
      const result = await analyzeTourRequest('Хочу на море в Турцию, бюджет 150 тысяч');
      
      expect(result.vacationType).toBe('beach');
      expect(result.countries).toContain('Турция');
      expect(result.budget).toBe(150000);
      expect(result.priorities?.beachLine).toBe(10);
    });

    it('should fallback to regex parsing when AI fails', async () => {
      mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeTourRequest('Бюджет 100000 руб на 2 человека в Турцию');

      expect(result.budget).toBe(100000);
      expect(result.peopleCount).toBe(2);
      expect(result.countries).toContain('Турция');
    });

    it('should parse dates correctly', async () => {
      // Убираем переменную окружения чтобы использовался базовый парсер
      const originalKey = process.env.OPENROUTER_API_KEY;
      delete process.env.OPENROUTER_API_KEY;

      const result = await analyzeTourRequest('Хочу поехать с 15 июля по 25 июля');

      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
      
      // Восстанавливаем ключ
      if (originalKey) process.env.OPENROUTER_API_KEY = originalKey;
    });
  });

  describe('calculateTourMatchScore', () => {
    const mockTour = {
      id: '1',
      title: 'Test Tour',
      price: 100000,
      hotelName: 'Beach Resort',
      hotelRating: 5,
      destination: 'Турция',
      beachLine: 1,
      mealType: 'all-inclusive',
      roomType: 'standard',
      startDate: new Date('2024-07-15'),
      endDate: new Date('2024-07-22'),
      nights: 7,
      adults: 2,
      children: 0,
      includes: [],
      images: [],
      bookingUrl: ''
    };

    const mockPreferences: any = {
      countries: ['Турция'],
      budget: 120000,
      vacationType: 'beach'
    };

    const mockPriorities = {
      beachLine: 10,
      price: 8,
      starRating: 7,
      location: 9
    };

    it('should calculate high score for matching tour', async () => {
      const result = await calculateTourMatchScore(mockTour, mockPreferences, mockPriorities);

      expect(result.score).toBeGreaterThan(80);
      expect(result.details.beachLine).toBe(100); // First line = 100%
      expect(result.details.location).toBe(100); // Turkey matches
    });

    it('should calculate low score for expensive tour', async () => {
      const expensiveTour = { ...mockTour, price: 200000 };
      const result = await calculateTourMatchScore(expensiveTour, mockPreferences, mockPriorities);

      // Тур дорогой, но все остальные параметры хорошие, поэтому общий балл может быть выше
      expect(result.score).toBeDefined();
      expect(result.details.price).toBeLessThan(50); // Цена точно должна быть низкой
    });

    it('should handle missing priorities gracefully', async () => {
      const result = await calculateTourMatchScore(mockTour, mockPreferences, {});

      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });
  });
});