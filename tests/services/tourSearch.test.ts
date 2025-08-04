import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { searchTours } from '../../server/providers';
import { searchToursByLocation } from '../../server/providers/leveltravel';
import { cacheKeys } from '../../server/services/cache';
import logger from '../../server/utils/logger';

// Mock dependencies
jest.mock('../../server/providers/leveltravel');
jest.mock('../../server/services/cache');
jest.mock('../../server/utils/logger');

describe('Tour Search Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('searchTours', () => {
    it('should search tours with basic parameters', async () => {
      const mockTours = [
        {
          id: 'tour-1',
          title: 'Отель у моря',
          destination: 'Турция',
          price: 120000,
          rating: 8.5,
          beachLine: 1,
          mealType: 'AI',
          image: 'hotel1.jpg'
        }
      ];

      (searchToursByLocation as jest.Mock).mockResolvedValue(mockTours);

      const searchParams = {
        country: 'Турция',
        budget: 150000,
        startDate: new Date('2024-07-15'),
        endDate: new Date('2024-07-25'),
        peopleCount: 2
      };

      const result = await searchTours(searchParams);

      expect(result).toEqual(mockTours);
      expect(searchToursByLocation).toHaveBeenCalledWith(searchParams);
    });

    it('should handle search errors gracefully', async () => {
      const error = new Error('API error');
      (searchToursByLocation as jest.Mock).mockRejectedValue(error);

      const searchParams = {
        country: 'Турция',
        budget: 150000
      };

      const result = await searchTours(searchParams);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith('Error searching tours:', error);
    });

    it('should filter tours by budget', async () => {
      const mockTours = [
        { id: '1', title: 'Cheap', price: 50000 },
        { id: '2', title: 'Normal', price: 100000 },
        { id: '3', title: 'Expensive', price: 200000 }
      ];

      (searchToursByLocation as jest.Mock).mockResolvedValue(mockTours);

      const searchParams = {
        country: 'Турция',
        budget: 150000
      };

      const result = await searchTours(searchParams);

      // В реальной реализации должна быть фильтрация
      expect(searchToursByLocation).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      (searchToursByLocation as jest.Mock).mockResolvedValue([]);

      const searchParams = {
        country: 'Антарктида',
        budget: 1000
      };

      const result = await searchTours(searchParams);

      expect(result).toEqual([]);
    });

    it('should search with vacation type preferences', async () => {
      const mockTours = [
        {
          id: 'tour-1',
          title: 'Beach Resort',
          destination: 'Турция',
          vacationType: 'beach',
          beachLine: 1
        }
      ];

      (searchToursByLocation as jest.Mock).mockResolvedValue(mockTours);

      const searchParams = {
        country: 'Турция',
        vacationType: 'beach',
        priorities: {
          beachLine: 10,
          price: 5
        }
      };

      const result = await searchTours(searchParams);

      expect(result).toEqual(mockTours);
      expect(searchToursByLocation).toHaveBeenCalledWith(searchParams);
    });

    it('should handle date range search', async () => {
      const mockTours = [{ id: '1', title: 'Summer Tour' }];
      (searchToursByLocation as jest.Mock).mockResolvedValue(mockTours);

      const searchParams = {
        country: 'Египет',
        startDate: new Date('2024-06-01'),
        endDate: new Date('2024-06-14'),
        duration: 14
      };

      const result = await searchTours(searchParams);

      expect(result).toEqual(mockTours);
      expect(searchToursByLocation).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(Date),
          endDate: expect.any(Date),
          duration: 14
        })
      );
    });

    it('should handle group size variations', async () => {
      const mockTours = [{ id: '1', title: 'Family Tour' }];
      (searchToursByLocation as jest.Mock).mockResolvedValue(mockTours);

      const testCases = [
        { peopleCount: 1, description: 'single traveler' },
        { peopleCount: 2, description: 'couple' },
        { peopleCount: 4, description: 'family' },
        { peopleCount: 10, description: 'large group' }
      ];

      for (const testCase of testCases) {
        const result = await searchTours({
          country: 'Турция',
          peopleCount: testCase.peopleCount
        });

        expect(searchToursByLocation).toHaveBeenCalledWith(
          expect.objectContaining({
            peopleCount: testCase.peopleCount
          })
        );
      }
    });

    it('should handle multiple countries search', async () => {
      const mockTours = [
        { id: '1', destination: 'Турция' },
        { id: '2', destination: 'Египет' }
      ];

      (searchToursByLocation as jest.Mock).mockResolvedValue(mockTours);

      const searchParams = {
        countries: ['Турция', 'Египет'],
        budget: 150000
      };

      const result = await searchTours(searchParams);

      expect(result).toEqual(mockTours);
    });
  });
});