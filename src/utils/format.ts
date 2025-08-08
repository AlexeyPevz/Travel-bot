/**
 * Утилиты форматирования для Mini App
 */

/**
 * Форматирование цены с разделителями тысяч
 */
export function formatPrice(price: number, currency: string = '₽'): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: currency === '₽' ? 'RUB' : currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Форматирование даты
 */
export function formatDate(date: string | Date, format: 'short' | 'long' = 'short'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'short') {
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short'
    }).format(d);
  }
  
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d);
}

/**
 * Форматирование диапазона дат
 */
export function formatDateRange(startDate: string | Date, endDate: string | Date): string {
  const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
  const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
  
  const startMonth = start.getMonth();
  const endMonth = end.getMonth();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  
  // Если в пределах одного месяца
  if (startMonth === endMonth && startYear === endYear) {
    return `${start.getDate()}-${end.getDate()} ${new Intl.DateTimeFormat('ru-RU', { month: 'long' }).format(start)}`;
  }
  
  // Если в пределах одного года
  if (startYear === endYear) {
    return `${formatDate(start, 'short')} - ${formatDate(end, 'short')}`;
  }
  
  // Разные годы
  return `${formatDate(start, 'long')} - ${formatDate(end, 'long')}`;
}

/**
 * Форматирование продолжительности
 */
export function formatDuration(nights: number): string {
  const lastDigit = nights % 10;
  const lastTwoDigits = nights % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return `${nights} ночей`;
  }
  
  if (lastDigit === 1) {
    return `${nights} ночь`;
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${nights} ночи`;
  }
  
  return `${nights} ночей`;
}

/**
 * Форматирование расстояния
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters} м`;
  }
  
  const km = meters / 1000;
  if (km < 10) {
    return `${km.toFixed(1)} км`;
  }
  
  return `${Math.round(km)} км`;
}

/**
 * Форматирование рейтинга
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Форматирование количества отзывов
 */
export function formatReviewsCount(count: number): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return `${count} отзывов`;
  }
  
  if (lastDigit === 1) {
    return `${count} отзыв`;
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} отзыва`;
  }
  
  return `${count} отзывов`;
}

/**
 * Форматирование процента скидки
 */
export function formatDiscount(oldPrice: number, newPrice: number): string {
  const discount = Math.round((1 - newPrice / oldPrice) * 100);
  return `-${discount}%`;
}

/**
 * Форматирование типа питания
 */
export function formatMealType(code: string): string {
  const mealTypes: Record<string, string> = {
    'RO': 'Без питания',
    'BB': 'Завтрак',
    'HB': 'Полупансион',
    'FB': 'Полный пансион',
    'AI': 'Все включено',
    'UAI': 'Ультра все включено'
  };
  
  return mealTypes[code] || code;
}

/**
 * Форматирование количества звезд
 */
export function formatStars(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(5 - stars);
}

/**
 * Форматирование множественного числа
 */
export function pluralize(count: number, one: string, few: string, many: string): string {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) {
    return `${count} ${many}`;
  }
  
  if (lastDigit === 1) {
    return `${count} ${one}`;
  }
  
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${count} ${few}`;
  }
  
  return `${count} ${many}`;
}