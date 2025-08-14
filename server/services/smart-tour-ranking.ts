import { Tour, SearchRequest, TravelPriorities, ScoreBreakdown } from '@shared/schema-v2';
import logger from '../utils/logger';

/**
 * Умное ранжирование туров с учетом приоритетов пользователя
 */
export function rankTours(
  tours: Tour[],
  searchRequest: SearchRequest,
  priorities: TravelPriorities
): { tour: Tour; score: number; breakdown: ScoreBreakdown }[] {
  const { weights } = priorities;
  
  // Фильтруем туры по бюджету
  const filteredTours = filterByBudget(tours, searchRequest.budget || 999999999, searchRequest.budgetType);
  
  // Считаем score для каждого тура
  const rankedTours = filteredTours.map(tour => {
    const breakdown = calculateScoreBreakdown(tour, searchRequest, weights);
    const score = calculateTotalScore(breakdown, weights);
    
    return {
      tour,
      score,
      breakdown
    };
  });
  
  // Сортируем по убыванию score
  rankedTours.sort((a, b) => b.score - a.score);
  
  logger.info(`Ranked ${rankedTours.length} tours, top score: ${rankedTours[0]?.score.toFixed(2)}`);
  
  return rankedTours;
}

/**
 * Фильтрация по бюджету (не показываем слишком дешевые туры)
 */
function filterByBudget(tours: Tour[], budget: number, budgetType?: string): Tour[] {
  // Минимальная цена - 40% от бюджета (чтобы не показывать совсем дешевые)
  const minPrice = budget * 0.4;
  
  return tours.filter(tour => {
    const tourPrice = budgetType === 'perPerson' 
      ? tour.price * (tour.adults || 2)
      : tour.price;
      
    return tourPrice >= minPrice && tourPrice <= budget;
  });
}

/**
 * Расчет оценок по каждому критерию
 */
function calculateScoreBreakdown(
  tour: Tour,
  searchRequest: SearchRequest,
  weights: TravelPriorities['weights']
): ScoreBreakdown {
  return {
    price: calculatePriceScore(tour.price, searchRequest.budget || 999999999, searchRequest.budgetType),
    stars: calculateStarsScore(tour.hotelStars || 0),
    beach: calculateBeachScore(tour),
    meal: calculateMealScore(tour.mealType, searchRequest.requirements),
    location: calculateLocationScore(tour),
    reviews: calculateReviewsScore(tour.rating),
    family: calculateFamilyScore(tour, searchRequest),
    activities: calculateActivitiesScore(tour),
    quietness: calculateQuietnessScore(tour),
    total: 0 // Заполним позже
  };
}

/**
 * Расчет общего score
 */
function calculateTotalScore(
  breakdown: ScoreBreakdown,
  weights: TravelPriorities['weights']
): number {
  let totalWeight = 0;
  let totalScore = 0;
  
  // Проходим по всем критериям кроме total
  const criteria = Object.keys(breakdown).filter(k => k !== 'total') as (keyof typeof weights)[];
  
  for (const criterion of criteria) {
    const weight = weights[criterion];
    const score = breakdown[criterion];
    
    if (weight && score !== undefined) {
      totalWeight += weight;
      totalScore += score * weight;
    }
  }
  
  // Нормализуем от 0 до 100
  const normalizedScore = totalWeight > 0 ? (totalScore / totalWeight) * 100 : 0;
  
  breakdown.total = normalizedScore;
  return normalizedScore;
}

// ========== ФУНКЦИИ РАСЧЕТА ОЦЕНОК ПО КРИТЕРИЯМ ==========

/**
 * Оценка цены (чем ближе к бюджету, но не превышая, тем лучше)
 */
function calculatePriceScore(price: number, budget: number, budgetType?: string): number {
  const effectiveBudget = budgetType === 'perPerson' ? budget : budget / 2; // Предполагаем 2 человека
  
  if (price > effectiveBudget) {
    return 0; // Превышение бюджета
  }
  
  // Оптимальная цена - 70-90% от бюджета
  const optimalMin = effectiveBudget * 0.7;
  const optimalMax = effectiveBudget * 0.9;
  
  if (price >= optimalMin && price <= optimalMax) {
    return 1.0; // Идеальная цена
  }
  
  if (price < optimalMin) {
    // Чем дешевле, тем хуже (может быть низкое качество)
    return 0.5 + (price / optimalMin) * 0.5;
  }
  
  // price > optimalMax && price <= budget
  return 0.9; // Немного дороговато, но приемлемо
}

/**
 * Оценка звездности отеля
 */
function calculateStarsScore(stars: number): number {
  // Простая линейная зависимость
  return stars / 5;
}

/**
 * Оценка пляжа
 */
function calculateBeachScore(tour: Tour): number {
  let score = 0.5; // Базовый score
  
  // Линия пляжа (чем ближе, тем лучше)
  if (tour.beachLine) {
    score = Math.max(0, 1 - (tour.beachLine - 1) * 0.25);
  }
  
  // Тип пляжа
  if (tour.beachType === 'sand' || tour.beachType === 'песчаный') {
    score += 0.1;
  }
  
  // Расстояние до пляжа
  if (tour.beachDistance !== undefined && tour.beachDistance !== null) {
    if (tour.beachDistance <= 100) {
      score += 0.1;
    } else if (tour.beachDistance > 500) {
      score -= 0.2;
    }
  }
  
  return Math.min(1, Math.max(0, score));
}

/**
 * Оценка типа питания
 */
function calculateMealScore(mealType?: string, requirements?: string[]): number {
  if (!mealType) return 0.5;
  
  const mealLower = mealType.toLowerCase();
  
  // Если есть специфические требования
  if (requirements?.includes('all_inclusive')) {
    return mealLower.includes('все включено') || mealLower.includes('all') ? 1.0 : 0.3;
  }
  
  // Общая оценка типов питания
  const mealScores: Record<string, number> = {
    'ultra': 1.0,
    'all': 0.9,
    'full': 0.7,
    'half': 0.6,
    'breakfast': 0.5,
    'bb': 0.5,
    'ro': 0.3,
    'без питания': 0.2
  };
  
  for (const [key, score] of Object.entries(mealScores)) {
    if (mealLower.includes(key)) {
      return score;
    }
  }
  
  return 0.5;
}

/**
 * Оценка расположения
 */
function calculateLocationScore(tour: Tour): number {
  let score = 0.5;
  
  // Расстояние до аэропорта
  if (tour.airportDistance !== undefined && tour.airportDistance !== null) {
    if (tour.airportDistance <= 30) {
      score += 0.2; // Близко к аэропорту
    } else if (tour.airportDistance > 100) {
      score -= 0.1; // Далеко от аэропорта
    }
  }
  
  // Координаты (можно добавить логику проверки популярных локаций)
  if (tour.latitude && tour.longitude) {
    score += 0.1; // Есть точные координаты
  }
  
  return Math.min(1, Math.max(0, score));
}

/**
 * Оценка отзывов
 */
function calculateReviewsScore(rating?: number | null): number {
  if (!rating) return 0.5;
  
  // Нормализуем от 0 до 1
  return rating / 5;
}

/**
 * Оценка для семейного отдыха
 */
function calculateFamilyScore(tour: Tour, searchRequest: SearchRequest): number {
  const hasChildren = (searchRequest.children || 0) > 0;
  
  if (!hasChildren) {
    // Для взрослых без детей семейные удобства не так важны
    return 0.5;
  }
  
  let score = 0.3; // Базовый score для семей
  
  // Детские удобства
  if (tour.hasKidsClub) score += 0.3;
  if (tour.hasAquapark) score += 0.2;
  if (tour.hasPool) score += 0.1;
  
  // Тип питания (для семей важно хорошее питание)
  if (tour.mealType?.toLowerCase().includes('all') || 
      tour.mealType?.toLowerCase().includes('все включено')) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

/**
 * Оценка активностей
 */
function calculateActivitiesScore(tour: Tour): number {
  let score = 0.3;
  
  // Инфраструктура для активностей
  if (tour.hasAquapark) score += 0.2;
  if (tour.hasFitness) score += 0.1;
  if (tour.hasPool) score += 0.1;
  if (tour.hasWifi) score += 0.1;
  
  // Близость к городу (больше возможностей для экскурсий)
  if (tour.airportDistance && tour.airportDistance <= 50) {
    score += 0.1;
  }
  
  // Анимация (если есть в описании)
  if (tour.description?.toLowerCase().includes('анимация')) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

/**
 * Оценка спокойствия
 */
function calculateQuietnessScore(tour: Tour): number {
  let score = 0.7; // Базовый score
  
  // Факторы, снижающие спокойствие
  if (tour.hasAquapark) score -= 0.2;
  if (tour.hasKidsClub) score -= 0.1;
  if (tour.description?.toLowerCase().includes('анимация')) score -= 0.2;
  if (tour.description?.toLowerCase().includes('дискотека')) score -= 0.2;
  
  // Факторы, повышающие спокойствие
  if (tour.description?.toLowerCase().includes('тихий')) score += 0.2;
  if (tour.description?.toLowerCase().includes('уединенный')) score += 0.2;
  if (tour.adults && tour.adults > 0 && !tour.children) score += 0.1;
  
  // Удаленность от аэропорта (дальше = спокойнее)
  if (tour.airportDistance && tour.airportDistance > 70) {
    score += 0.1;
  }
  
  return Math.min(1, Math.max(0, score));
}

/**
 * Группировка туров по отелям для удобства отображения
 */
export function groupToursByHotel(
  rankedTours: { tour: Tour; score: number; breakdown: ScoreBreakdown }[]
): Map<string, typeof rankedTours> {
  const grouped = new Map<string, typeof rankedTours>();
  
  for (const item of rankedTours) {
    const hotelKey = `${item.tour.hotel}_${item.tour.hotelStars || 0}`;
    
    if (!grouped.has(hotelKey)) {
      grouped.set(hotelKey, []);
    }
    
    grouped.get(hotelKey)!.push(item);
  }
  
  return grouped;
}