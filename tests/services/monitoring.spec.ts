import { monitorProfileTours, checkDeadline } from '../../server/services/monitoring';

jest.mock('../../server/bot', () => ({ getBot: () => ({ sendMessage: jest.fn(), sendPhoto: jest.fn() }) }));
jest.mock('../../server/providers', () => ({ searchTours: jest.fn(async () => ([{
  provider: 'level.travel', id: 'ext-1', title: 'Tour 1', price: 150000, image: '', link: 'https://example.com'
}])) }));

jest.mock('../../db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn()
  }
}));

const { db } = jest.requireMock('../../db');
const { searchTours } = jest.requireMock('../../server/providers');

function chainSelect(result: any[]) {
  return { from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue(result) }), limit: jest.fn().mockReturnValue(result) }) };
}

function chainInsert(returning: any[]) { return { values: jest.fn().mockReturnThis(), returning: jest.fn().mockResolvedValue(returning) }; }
function chainUpdate() { return { set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis() }; }

describe('monitoring service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.insert as jest.Mock).mockReturnValue(chainInsert([{ id: 10, provider: 'level.travel' }]));
    (db.update as jest.Mock).mockReturnValue(chainUpdate());
  });

  it('monitorProfileTours saves match and sends notification for high score', async () => {
    // profile fetch
    (db.select as jest.Mock)
      .mockReturnValueOnce(chainSelect([{ id: 1, userId: 'u1', countries: ['Турция'], budget: 200000, priorities: { price: 9 }, startDate: new Date(), endDate: new Date() }]))
      // existing tour not found
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue([]) }) }) })
      // existing match not found
      .mockReturnValueOnce({ from: jest.fn().mockReturnValue({ where: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue([]) }) }) });

    await monitorProfileTours('u1', 1);
    expect(searchTours).toHaveBeenCalled();
    expect(db.insert).toHaveBeenCalled();
  });

  it('checkDeadline suggests alternatives and completes task', async () => {
    const now = new Date();
    (db.select as jest.Mock)
      .mockReturnValueOnce(chainSelect([{ id: 2, userId: 'u2', budget: 100000, deadline: new Date(now.getTime() - 1000), countries: ['TR'], startDate: now, endDate: new Date(now.getTime()+86400000) }]))
    ;

    await checkDeadline('u2', 2);
    expect(db.update).toHaveBeenCalled();
  });
});