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
      const mockResponse = {
        data: {
          choices: [{
            message: {
              content: JSON.stringify({
                vacationType: 'beach',
                countries: ['Турция', 'Египет'],
                budget: 150000,
                budgetPerPerson: false,
                peopleCount: 2,
                dateType: 'flexible',
                flexibleMonth: 'август',
                priorities: {
                  beachLine: 10,
                  allInclusive: 8,
                  starRating: 7
                }
              })
            }
          }]
        }
      };

      mockedAxios.post.mockResolvedValueOnce(mockResponse);

      const result = await analyzeTourRequest('Хочу на море в августе, бюджет 150к на двоих, первая линия обязательно');

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
      mockedAxios.post.mockRejectedValueOnce(new Error('API Error'));

      const result = await analyzeTourRequest('Хочу поехать с 15 июля по 25 июля');

      expect(result.dateType).toBe('fixed');
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
    });
  });

  describe('calculateTourMatchScore', () => {
    const mockTour = {
      id: '1',
      provider: 'test',
      title: 'Test Hotel',
      country: 'Турция',
      resort: 'Анталья',
      hotelName: 'Test Hotel',
      stars: 5,
      beachLine: 1,
      mealType: 'AI',
      price: 120000,
      startDate: new Date('2024-08-15'),
      endDate: new Date('2024-08-25'),
      nights: 10,
      rating: 4.5,
      reviewsCount: 100,
      photoUrl: 'test.jpg',
      link: 'test.com'
    };

    const mockPreferences = {
      countries: ['Турция'],
      budget: 150000,
      budgetPerPerson: false,
      peopleCount: 2
    };

    const mockPriorities = {
      beachLine: 10,
      starRating: 8,
      mealType: 7,
      price: 5
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

      expect(result.score).toBeLessThan(70);
      expect(result.details.price).toBeLessThan(50);
    });

    it('should handle missing priorities gracefully', async () => {
      const result = await calculateTourMatchScore(mockTour, mockPreferences, {});

      expect(result.score).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });
  });
});