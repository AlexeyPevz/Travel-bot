import { fetchToursFromAllProviders } from '../../server/providers';

jest.mock('../../server/providers/travelata', () => ({ fetchToursFromTravelata: jest.fn(async () => ([{ provider: 'travelata', title: 'TA', price: 100 }])), }));
jest.mock('../../server/providers/sletat', () => ({ fetchToursFromSletat: jest.fn(async () => ([{ provider: 'sletat', title: 'SL', price: 90 }])), }));
jest.mock('../../server/providers/leveltravel', () => ({ fetchToursFromLevelTravel: jest.fn(async () => ([{ provider: 'level.travel', title: 'LT', price: 110 }])) }));

jest.mock('../../server/services/db', () => ({
  dbService: {
    saveTourBatch: jest.fn(async (tours: any[]) => tours.map((t, i) => ({ ...t, id: i + 1 })))
  }
}));

describe('providers aggregator', () => {
  it('aggregates tours from all providers and saves them', async () => {
    const res = await fetchToursFromAllProviders({ destination: 'Турция', adults: 2 });
    expect(res.length).toBe(3);
    expect(res.some(t => t.provider === 'travelata')).toBe(true);
    expect(res.some(t => t.provider === 'sletat')).toBe(true);
    expect(res.some(t => t.provider === 'level.travel')).toBe(true);
    expect(res.every(t => 'id' in t)).toBe(true);
  });

  it('handles provider errors gracefully', async () => {
    const { fetchToursFromSletat } = jest.requireMock('../../server/providers/sletat');
    (fetchToursFromSletat as jest.Mock).mockRejectedValueOnce(new Error('fail'));
    const res = await fetchToursFromAllProviders({ destination: 'Египет', adults: 2 });
    expect(res.length).toBeGreaterThanOrEqual(2);
  });
});