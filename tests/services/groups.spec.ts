import { createOrUpdateGroupProfile, aggregateGroupProfiles, handleGroupVote } from '../../server/services/groups';

function chainSelect(result: any[]) {
  return {
    from: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue(result) }),
      limit: jest.fn().mockReturnValue(result)
    })
  };
}

function chainInsert(returning: any[]) {
  return {
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(returning),
    onConflictDoNothing: jest.fn().mockReturnThis()
  };
}

function chainUpdate() {
  return {
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis()
  };
}

jest.mock('../../db', () => ({
  db: {
    select: jest.fn().mockReturnValue(chainSelect([])),
    insert: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock('node-telegram-bot-api', () => ({ __esModule: true, default: jest.fn().mockImplementation(() => ({ sendMessage: jest.fn(), sendPhoto: jest.fn() })) }));

const { db } = jest.requireMock('../../db');

describe('groups service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.insert as jest.Mock).mockReturnValue(chainInsert([{ id: 1 }]));
    (db.update as jest.Mock).mockReturnValue(chainUpdate());
  });

  it('createOrUpdateGroupProfile creates when not exists', async () => {
    (db.select as jest.Mock).mockReturnValueOnce(chainSelect([]));
    const id = await createOrUpdateGroupProfile('-1', 'Chat', ['u1']);
    expect(id).toBe(1);
    expect(db.insert).toHaveBeenCalled();
  });

  it('aggregateGroupProfiles aggregates and stores', async () => {
    const now = new Date();
    (db.select as jest.Mock)
      .mockReturnValueOnce(chainSelect([{ id: 1, memberIds: ['u1','u2'] }]))
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue([
        { userId: 'u1', countries: ['TR'], budget: 100000, startDate: now, endDate: new Date(now.getTime()+86400000), tripDuration: 7, priorities: { price: 8 } },
        { userId: 'u2', countries: ['EG'], budget: 120000, startDate: now, endDate: new Date(now.getTime()+43200000), tripDuration: 10, priorities: { price: 6 } },
      ]) }) });

    const res = await aggregateGroupProfiles(1);
    expect(db.update).toHaveBeenCalled();
    expect(res?.aggregatedProfile.countries.length).toBeGreaterThan(0);
  });

  it('handleGroupVote counts votes', async () => {
    (db.select as jest.Mock)
      .mockReturnValueOnce(chainSelect([]))
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue([{ vote: 'yes' }, { vote: 'no' }, { vote: 'yes' }]) }) });
    const counts = await handleGroupVote(1, 2, 'u1', 'yes');
    expect(db.insert).toHaveBeenCalled();
    expect(counts.yes).toBe(2);
    expect(counts.no).toBe(1);
  });
});