import { aggregateGroupProfiles } from '../../server/services/groups';

describe('Groups Service', () => {
  describe('aggregateGroupProfiles', () => {
    it('should aggregate countries from all profiles', () => {
      const profiles = [
        {
          countries: ['Турция', 'Египет'],
          budget: 100000,
          priorities: { beachLine: 10, starRating: 8 }
        },
        {
          countries: ['Египет', 'ОАЭ'],
          budget: 150000,
          priorities: { beachLine: 8, starRating: 10 }
        }
      ];

      const result = aggregateGroupProfiles(profiles);

      expect(result.countries).toContain('Турция');
      expect(result.countries).toContain('Египет');
      expect(result.countries).toContain('ОАЭ');
      expect(result.countries).toHaveLength(3);
    });

    it('should calculate average budget', () => {
      const profiles = [
        { budget: 100000 },
        { budget: 150000 },
        { budget: 200000 }
      ];

      const result = aggregateGroupProfiles(profiles);

      expect(result.budget).toBe(150000);
    });

    it('should find date intersection', () => {
      const profiles = [
        {
          startDate: new Date('2024-08-10'),
          endDate: new Date('2024-08-25')
        },
        {
          startDate: new Date('2024-08-15'),
          endDate: new Date('2024-08-30')
        }
      ];

      const result = aggregateGroupProfiles(profiles);

      expect(result.startDate).toEqual(new Date('2024-08-15'));
      expect(result.endDate).toEqual(new Date('2024-08-25'));
    });

    it('should average priorities', () => {
      const profiles = [
        {
          priorities: { beachLine: 10, starRating: 8, price: 6 }
        },
        {
          priorities: { beachLine: 8, starRating: 10, price: 4 }
        },
        {
          priorities: { beachLine: 6, starRating: 6, price: 8 }
        }
      ];

      const result = aggregateGroupProfiles(profiles);

      expect(result.priorities.beachLine).toBe(8);
      expect(result.priorities.starRating).toBe(8);
      expect(result.priorities.price).toBe(6);
    });

    it('should handle empty profiles array', () => {
      const result = aggregateGroupProfiles([]);

      expect(result.countries).toEqual([]);
      expect(result.budget).toBe(0);
      expect(result.priorities).toEqual({});
    });

    it('should handle profiles with missing data', () => {
      const profiles = [
        { countries: ['Турция'] },
        { budget: 100000 },
        { priorities: { beachLine: 10 } }
      ];

      const result = aggregateGroupProfiles(profiles);

      expect(result.countries).toContain('Турция');
      expect(result.budget).toBe(100000);
      expect(result.priorities.beachLine).toBe(10);
    });
  });
});