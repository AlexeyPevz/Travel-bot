import { analyzeTourRequest, calculateTourMatchScore } from '../../server/services/openrouter';

describe('OpenRouter basic parsing and scoring (no external calls)', () => {
  it('parseBasicTourRequest: extracts countries, budget, dates, people and priorities', async () => {
    const text = 'Хочу в Турцию на море, 5 звезд, первая линия, все включено, бюджет 200 тыс на двоих, с 15 июля по 25 июля';
    const result = await analyzeTourRequest(text);

    expect(result.countries).toContain('Турция');
    expect(result.budget).toBe(200000);
    expect(result.peopleCount).toBe(2);
    expect(result.vacationType).toBe('beach');
    if (result.startDate) expect(result.startDate).toBeInstanceOf(Date as any);
    if (result.endDate) expect(result.endDate).toBeInstanceOf(Date as any);
    expect(result.priorities?.starRating).toBeGreaterThanOrEqual(5);
    expect(result.priorities?.beachLine).toBe(10);
    expect(result.priorities?.mealType).toBeGreaterThanOrEqual(6);
  });

  it('calculateTourMatchScore: returns score and details with country match and beach line', async () => {
    const preferences = {
      countries: ['Турция'],
      budget: 200000,
      priorities: { starRating: 8, beachLine: 10, mealType: 8, price: 7, hotelRating: 5, location: 8 },
    } as any;

    const tour = {
      title: 'Rixos Premium Belek',
      country: 'Турция',
      hotelName: 'Rixos Premium Belek',
      starRating: 5,
      beachLine: 1,
      mealType: 'AI',
      price: 180000,
      hotelRating: 9.2,
    };

    const res = await calculateTourMatchScore(tour, preferences, preferences.priorities!);
    expect(res.score).toBeGreaterThan(70);
    expect(res.details.beachLine).toBe(100);
    expect(res.details.location).toBe(100);
    expect(typeof res.analysis).toBe('string');
  });
});