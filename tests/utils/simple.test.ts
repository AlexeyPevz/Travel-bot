import { describe, it, expect } from '@jest/globals';

describe('Simple Test Suite', () => {
  it('should pass basic test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should work with arrays', () => {
    const arr = [1, 2, 3];
    expect(arr).toHaveLength(3);
    expect(arr).toContain(2);
  });

  it('should work with objects', () => {
    const obj = { name: 'Test', value: 42 };
    expect(obj).toHaveProperty('name', 'Test');
    expect(obj.value).toBe(42);
  });

  it('should handle async operations', async () => {
    const promise = Promise.resolve('success');
    await expect(promise).resolves.toBe('success');
  });

  it('should test date parsing', () => {
    const dateStr = '2024-07-15';
    const date = new Date(dateStr);
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(6); // July is month 6 (0-indexed)
    expect(date.getDate()).toBe(15);
  });

  it('should test budget calculations', () => {
    const budget = 150000;
    const peopleCount = 2;
    const perPerson = budget / peopleCount;
    
    expect(perPerson).toBe(75000);
    expect(perPerson).toBeGreaterThan(50000);
    expect(perPerson).toBeLessThan(100000);
  });

  it('should test tour priorities', () => {
    const priorities = {
      beachLine: 10,
      price: 8,
      mealType: 7,
      starRating: 5
    };
    
    const sorted = Object.entries(priorities)
      .sort(([, a], [, b]) => b - a)
      .map(([key]) => key);
    
    expect(sorted[0]).toBe('beachLine');
    expect(sorted[sorted.length - 1]).toBe('starRating');
  });
});