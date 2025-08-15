export type SortBy = 'match' | 'price' | 'stars' | 'rating';

/**
 * Sort tours by provided criterion. Falls back to 'match'.
 */
export function sortTours<T extends Record<string, any>>(list: T[], sortBy: SortBy): T[] {
  const arr = list.slice();
  switch (sortBy) {
    case 'price':
      arr.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      break;
    case 'stars':
      arr.sort((a, b) => (b.hotelStars ?? 0) - (a.hotelStars ?? 0));
      break;
    case 'rating':
      arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case 'match':
    default:
      arr.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  }
  return arr;
}