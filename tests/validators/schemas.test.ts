import {
  profileSchema,
  tourSearchSchema,
  analyzeRequestSchema,
  createGroupSchema,
  voteSchema,
  watchlistSchema
} from '../../server/validators/schemas';

describe('Validation Schemas', () => {
  describe('profileSchema', () => {
    it('should validate valid profile data', () => {
      const validProfile = {
        userId: '123456',
        name: 'John Doe',
        vacationType: 'beach',
        countries: ['Турция', 'Египет'],
        budget: 150000,
        budgetPerPerson: false,
        peopleCount: 2,
        priorities: {
          beachLine: 10,
          starRating: 8
        }
      };

      const result = profileSchema.parse(validProfile);
      expect(result).toEqual(validProfile);
    });

    it('should reject invalid vacation type', () => {
      const invalidProfile = {
        userId: '123456',
        vacationType: 'invalid_type'
      };

      expect(() => profileSchema.parse(invalidProfile)).toThrow();
    });

    it('should set default people count', () => {
      const profile = {
        userId: '123456'
      };

      const result = profileSchema.parse(profile);
      expect(result.peopleCount).toBe(2);
    });
  });

  describe('tourSearchSchema', () => {
    it('should transform string numbers to numbers', () => {
      const search = {
        budget: '150000',
        duration: '10',
        peopleCount: '2'
      };

      const result = tourSearchSchema.parse(search);
      expect(result.budget).toBe(150000);
      expect(result.duration).toBe(10);
      expect(result.peopleCount).toBe(2);
    });

    it('should transform string dates to Date objects', () => {
      const search = {
        startDate: '2024-08-15',
        endDate: '2024-08-25'
      };

      const result = tourSearchSchema.parse(search);
      expect(result.startDate).toBeInstanceOf(Date);
      expect(result.endDate).toBeInstanceOf(Date);
    });

    it('should handle array or single country', () => {
      const searchArray = { countries: ['Турция', 'Египет'] };
      const searchSingle = { countries: 'Турция' };

      const resultArray = tourSearchSchema.parse(searchArray);
      const resultSingle = tourSearchSchema.parse(searchSingle);

      expect(resultArray.countries).toEqual(['Турция', 'Египет']);
      expect(resultSingle.countries).toBe('Турция');
    });
  });

  describe('analyzeRequestSchema', () => {
    it('should validate message length', () => {
      const validRequest = {
        message: 'Хочу поехать на море в августе',
        userId: '123456'
      };

      const result = analyzeRequestSchema.parse(validRequest);
      expect(result).toEqual(validRequest);
    });

    it('should reject too short message', () => {
      const invalidRequest = {
        message: 'Hi'
      };

      expect(() => analyzeRequestSchema.parse(invalidRequest)).toThrow();
    });

    it('should reject too long message', () => {
      const invalidRequest = {
        message: 'a'.repeat(1001)
      };

      expect(() => analyzeRequestSchema.parse(invalidRequest)).toThrow();
    });
  });

  describe('voteSchema', () => {
    it('should validate vote values', () => {
      const validVote = {
        groupId: 1,
        tourId: 1,
        userId: '123456',
        vote: 'yes',
        comment: 'Looks great!'
      };

      const result = voteSchema.parse(validVote);
      expect(result).toEqual(validVote);
    });

    it('should reject invalid vote value', () => {
      const invalidVote = {
        groupId: 1,
        tourId: 1,
        userId: '123456',
        vote: 'invalid'
      };

      expect(() => voteSchema.parse(invalidVote)).toThrow();
    });
  });

  describe('watchlistSchema', () => {
    it('should validate watchlist data', () => {
      const validWatchlist = {
        userId: '123456',
        title: 'Summer vacation',
        description: 'Looking for beach holidays',
        countries: ['Турция'],
        budgetRange: {
          min: 100000,
          max: 200000
        }
      };

      const result = watchlistSchema.parse(validWatchlist);
      expect(result).toEqual(validWatchlist);
    });

    it('should reject too short title', () => {
      const invalidWatchlist = {
        userId: '123456',
        title: 'Hi'
      };

      expect(() => watchlistSchema.parse(invalidWatchlist)).toThrow();
    });
  });
});