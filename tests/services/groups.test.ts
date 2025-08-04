import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import {
  createOrUpdateGroupProfile,
  aggregateGroupProfiles,
  handleGroupVote,
  getGroupConsensus,
  notifyGroupMembers
} from '../../server/services/groups';
import { db } from '../../db';
import { groupProfiles, profiles, tourVotes } from '@shared/schema';
import logger from '../../server/utils/logger';

// Mock dependencies
jest.mock('../../db');
jest.mock('../../server/utils/logger');

describe('Group Services', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createOrUpdateGroupProfile', () => {
    it('should create new group profile', async () => {
      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 1, chatId: '-123456' }])
      };

      (db.insert as jest.Mock).mockReturnValue(mockInsert);
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([])
          })
        })
      });

      const result = await createOrUpdateGroupProfile('-123456', 'Test Group', ['user1', 'user2']);

      expect(result).toBe(1);
      expect(mockInsert.values).toHaveBeenCalledWith({
        chatId: '-123456',
        name: 'Test Group',
        memberIds: ['user1', 'user2']
      });
    });

    it('should update existing group profile', async () => {
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{ id: 2 }])
      };

      (db.update as jest.Mock).mockReturnValue(mockUpdate);
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ id: 2, chatId: '-123456' }])
          })
        })
      });

      const result = await createOrUpdateGroupProfile('-123456', 'Updated Group', ['user1', 'user2', 'user3']);

      expect(result).toBe(2);
      expect(mockUpdate.set).toHaveBeenCalledWith({
        name: 'Updated Group',
        memberIds: ['user1', 'user2', 'user3']
      });
    });

    it('should handle database errors', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockRejectedValue(new Error('DB Error'))
          })
        })
      });

      await expect(createOrUpdateGroupProfile('-123456', 'Test Group', []))
        .rejects.toThrow('DB Error');
    });
  });

  describe('handleGroupVote', () => {
    it('should create new vote', async () => {
      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{
          id: 1,
          groupId: 1,
          tourId: 'tour-123',
          userId: 'user-456',
          vote: 5
        }])
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockResolvedValue([
          { vote: 5, count: '3' },
          { vote: 3, count: '1' }
        ])
      };

      (db.insert as jest.Mock).mockReturnValue(mockInsert);
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await handleGroupVote(1, 'tour-123', 'user-456', 5, 'Great option!');

      expect(result).toEqual([
        { vote: 5, count: 3 },
        { vote: 3, count: 1 }
      ]);
      
      expect(mockInsert.values).toHaveBeenCalledWith({
        groupId: 1,
        tourId: 'tour-123',
        userId: 'user-456',
        vote: 5,
        comment: 'Great option!'
      });
    });

    it('should update existing vote', async () => {
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([{
          id: 1,
          vote: 4
        }])
      };

      const mockSelect = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: 1, vote: 3 }]),
        groupBy: jest.fn().mockResolvedValue([
          { vote: 4, count: '2' },
          { vote: 5, count: '1' }
        ])
      };

      (db.update as jest.Mock).mockReturnValue(mockUpdate);
      (db.select as jest.Mock).mockReturnValue(mockSelect);

      const result = await handleGroupVote(1, 'tour-123', 'user-456', 4);

      expect(mockUpdate.set).toHaveBeenCalledWith({
        vote: 4,
        comment: null,
        updatedAt: expect.any(Date)
      });
    });

    it('should handle invalid vote values', async () => {
      await expect(handleGroupVote(1, 'tour-123', 'user-456', 6))
        .rejects.toThrow();
    });
  });

  describe('aggregateGroupProfiles', () => {
    it('should aggregate member preferences', async () => {
      const mockMembers = [
        {
          vacationType: 'beach',
          countries: ['Турция', 'Египет'],
          budget: 150000,
          peopleCount: 2,
          priorities: { beachLine: 10, price: 5 }
        },
        {
          vacationType: 'beach',
          countries: ['Турция', 'Греция'],
          budget: 200000,
          peopleCount: 2,
          priorities: { beachLine: 8, price: 7 }
        }
      ];

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([])
      };

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn()
            .mockReturnValueOnce({
              limit: jest.fn().mockResolvedValue([{ memberIds: ['user1', 'user2'] }])
            })
            .mockReturnValueOnce({
              where: jest.fn().mockResolvedValue(mockMembers)
            })
        })
      });

      (db.update as jest.Mock).mockReturnValue(mockUpdate);

      await aggregateGroupProfiles(1);

      expect(mockUpdate.set).toHaveBeenCalledWith(
        expect.objectContaining({
          aggregatedPreferences: expect.objectContaining({
            vacationType: 'beach',
            countries: expect.arrayContaining(['Турция']),
            averageBudget: 175000,
            totalPeopleCount: 4
          })
        })
      );
    });

    it('should handle groups with no members', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([{ memberIds: [] }])
          })
        })
      });

      await aggregateGroupProfiles(1);

      expect(db.update).not.toHaveBeenCalled();
    });

    it('should handle missing member profiles', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn()
            .mockReturnValueOnce({
              limit: jest.fn().mockResolvedValue([{ memberIds: ['user1', 'user2'] }])
            })
            .mockReturnValueOnce({
              where: jest.fn().mockResolvedValue([])
            })
        })
      });

      await aggregateGroupProfiles(1);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No member profiles found')
      );
    });
  });

  describe('getGroupConsensus', () => {
    it('should calculate consensus for unanimous votes', async () => {
      const votes = [
        { vote: 5, count: 5 }
      ];

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockResolvedValue(votes)
          })
        })
      });

      const result = await getGroupConsensus(1, 'tour-123');

      expect(result).toEqual({
        averageScore: 5,
        consensus: 'high',
        distribution: votes
      });
    });

    it('should calculate consensus for mixed votes', async () => {
      const votes = [
        { vote: 5, count: 2 },
        { vote: 3, count: 2 },
        { vote: 1, count: 1 }
      ];

      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockResolvedValue(votes)
          })
        })
      });

      const result = await getGroupConsensus(1, 'tour-123');

      expect(result.averageScore).toBeCloseTo(3.4, 1);
      expect(result.consensus).toBe('medium');
    });

    it('should handle no votes', async () => {
      (db.select as jest.Mock).mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            groupBy: jest.fn().mockResolvedValue([])
          })
        })
      });

      const result = await getGroupConsensus(1, 'tour-123');

      expect(result).toEqual({
        averageScore: 0,
        consensus: 'none',
        distribution: []
      });
    });
  });
});