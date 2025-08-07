import { 
  VacationType, 
  detectVacationType, 
  getParameterWeights,
  getRelevantParameters 
} from '../types/vacationTypes';
import { Profile } from '../../shared/schema';
import logger from '../utils/logger';

/**
 * Интерфейс для тура с параметрами
 */
export interface TourWithParameters {
  id: number;
  title: string;
  price: number;
  // Базовые параметры
  location?: number;
  hotelRating?: number;
  userReviews?: number;
  safety?: number;
  // Параметры для разных типов отдыха
  [key: string]: any;
}

/**
 * Интерфейс для результата матчинга
 */
export interface MatchResult {
  tourId: number;
  matchScore: number;
  parameterScores: Record<string, number>;
  vacationTypes: VacationType[];
  explanation: string;
}

/**
 * Расчет соответствия тура профилю пользователя
 */
export function calculateTourMatch(
  tour: TourWithParameters,
  profile: Partial<Profile>,
  userQuery?: string
): MatchResult {
  // Определяем типы отдыха
  const vacationTypes = detectVacationTypes(profile, userQuery, tour);
  
  // Получаем веса параметров для выбранных типов
  const weights = getParameterWeights(vacationTypes);
  
  // Получаем релевантные параметры
  const relevantParams = getRelevantParameters(vacationTypes);
  
  // Рассчитываем баллы по каждому параметру
  const parameterScores: Record<string, number> = {};
  let totalScore = 0;
  let totalWeight = 0;
  
  relevantParams.forEach(param => {
    const weight = weights[param] || 5;
    const score = calculateParameterScore(param, tour, profile);
    
    parameterScores[param] = score;
    totalScore += score * weight;
    totalWeight += weight;
  });
  
  // Нормализуем общий балл
  const matchScore = totalWeight > 0 ? totalScore / totalWeight : 0;
  
  // Генерируем объяснение
  const explanation = generateMatchExplanation(
    parameterScores,
    weights,
    vacationTypes
  );
  
  return {
    tourId: tour.id,
    matchScore,
    parameterScores,
    vacationTypes,
    explanation
  };
}

/**
 * Определение типов отдыха на основе профиля и запроса
 */
function detectVacationTypes(
  profile: Partial<Profile>,
  userQuery?: string,
  tour?: TourWithParameters
): VacationType[] {
  const detectedTypes = new Set<VacationType>();
  
  // Анализируем запрос пользователя
  if (userQuery) {
    detectVacationType(userQuery).forEach(type => detectedTypes.add(type));
  }
  
  // Анализируем предпочтения из профиля
  if (profile.preferences) {
    const prefsText = typeof profile.preferences === 'string' 
      ? profile.preferences 
      : JSON.stringify(profile.preferences);
    detectVacationType(prefsText).forEach(type => detectedTypes.add(type));
  }
  
  // Анализируем тип отдыха из профиля
  if (profile.vacationType) {
    const vacType = profile.vacationType as string;
    if (Object.values(VacationType).includes(vacType as VacationType)) {
      detectedTypes.add(vacType as VacationType);
    }
  }
  
  // Анализируем параметры тура
  if (tour) {
    if (tour.title) {
      detectVacationType(tour.title).forEach(type => detectedTypes.add(type));
    }
  }
  
  // Анализируем наличие детей для семейного отдыха
  if (profile.children && profile.children > 0) {
    detectedTypes.add(VacationType.FAMILY);
  }
  
  // Если ничего не определено, используем пляжный по умолчанию
  if (detectedTypes.size === 0) {
    detectedTypes.add(VacationType.BEACH);
  }
  
  return Array.from(detectedTypes);
}

/**
 * Расчет балла по конкретному параметру
 */
function calculateParameterScore(
  param: string,
  tour: TourWithParameters,
  profile: Partial<Profile>
): number {
  switch (param) {
    case 'price':
      return calculatePriceScore(tour.price, profile.budget);
      
    case 'location':
      return tour.location || 5;
      
    case 'hotelRating':
      return normalizeScore(tour.hotelRating || 0, 5);
      
    case 'userReviews':
      return normalizeScore(tour.userReviews || 0, 10);
      
    case 'safety':
      return tour.safety || 7;
      
    // Пляжные параметры
    case 'beachLine':
      return tour.beachLine ? (11 - tour.beachLine) : 5; // Чем ближе, тем лучше
      
    case 'beachQuality':
      return tour.beachQuality || 5;
      
    case 'seaDistance':
      return tour.seaDistance !== undefined 
        ? normalizeScore(1000 - tour.seaDistance, 1000) * 10 
        : 5;
        
    // Горнолыжные параметры
    case 'slopeDistance':
      return tour.slopeDistance !== undefined
        ? normalizeScore(1000 - tour.slopeDistance, 1000) * 10
        : 5;
        
    case 'snowQuality':
      return tour.snowQuality || 5;
      
    case 'slopeVariety':
      return tour.slopeVariety || 5;
      
    // Экскурсионные параметры
    case 'sightseeingDistance':
      return tour.sightseeingDistance !== undefined
        ? normalizeScore(50 - tour.sightseeingDistance, 50) * 10
        : 5;
        
    case 'culturalRichness':
      return tour.culturalRichness || 5;
      
    // Семейные параметры
    case 'kidsClub':
      if (profile.children && profile.children > 0) {
        return tour.kidsClub ? 10 : 0;
      }
      return 5;
      
    case 'familyRooms':
      if (profile.children && profile.children > 0) {
        return tour.familyRooms ? 10 : 3;
      }
      return 5;
      
    default:
      return tour[param] || 5;
  }
}

/**
 * Расчет балла по цене
 */
function calculatePriceScore(tourPrice: number, userBudget?: number): number {
  if (!userBudget) return 5;
  
  const ratio = tourPrice / userBudget;
  
  if (ratio <= 0.7) return 10;      // Очень дешево
  if (ratio <= 0.85) return 9;      // Дешево
  if (ratio <= 1.0) return 8;       // В рамках бюджета
  if (ratio <= 1.1) return 6;       // Немного дороже
  if (ratio <= 1.2) return 4;       // Дороже
  if (ratio <= 1.5) return 2;       // Значительно дороже
  return 0;                         // Слишком дорого
}

/**
 * Нормализация балла к диапазону 0-10
 */
function normalizeScore(value: number, maxValue: number): number {
  if (maxValue === 0) return 5;
  const normalized = (value / maxValue) * 10;
  return Math.min(10, Math.max(0, normalized));
}

/**
 * Генерация объяснения матчинга
 */
function generateMatchExplanation(
  scores: Record<string, number>,
  weights: Record<string, number>,
  vacationTypes: VacationType[]
): string {
  const explanations: string[] = [];
  
  // Сортируем параметры по важности (вес * балл)
  const sortedParams = Object.entries(scores)
    .map(([param, score]) => ({
      param,
      score,
      weight: weights[param] || 5,
      impact: score * (weights[param] || 5)
    }))
    .sort((a, b) => b.impact - a.impact);
  
  // Добавляем топ-3 положительных факторов
  const positiveFactors = sortedParams
    .filter(p => p.score >= 7)
    .slice(0, 3);
    
  if (positiveFactors.length > 0) {
    explanations.push('Сильные стороны:');
    positiveFactors.forEach(factor => {
      explanations.push(`• ${getParameterName(factor.param)}: ${getScoreDescription(factor.score)}`);
    });
  }
  
  // Добавляем слабые стороны, если есть
  const negativeFactors = sortedParams
    .filter(p => p.score < 5)
    .slice(0, 2);
    
  if (negativeFactors.length > 0) {
    explanations.push('\nСлабые стороны:');
    negativeFactors.forEach(factor => {
      explanations.push(`• ${getParameterName(factor.param)}: ${getScoreDescription(factor.score)}`);
    });
  }
  
  return explanations.join('\n');
}

/**
 * Получение читаемого названия параметра
 */
function getParameterName(param: string): string {
  const names: Record<string, string> = {
    price: 'Цена',
    location: 'Расположение',
    hotelRating: 'Рейтинг отеля',
    userReviews: 'Отзывы',
    safety: 'Безопасность',
    beachLine: 'Линия пляжа',
    beachQuality: 'Качество пляжа',
    seaDistance: 'Расстояние до моря',
    slopeDistance: 'Расстояние до подъемника',
    snowQuality: 'Качество снега',
    slopeVariety: 'Разнообразие трасс',
    sightseeingDistance: 'Близость достопримечательностей',
    culturalRichness: 'Культурное богатство',
    kidsClub: 'Детский клуб',
    familyRooms: 'Семейные номера'
  };
  
  return names[param] || param;
}

/**
 * Описание балла
 */
function getScoreDescription(score: number): string {
  if (score >= 9) return 'отлично';
  if (score >= 7) return 'хорошо';
  if (score >= 5) return 'средне';
  if (score >= 3) return 'ниже среднего';
  return 'плохо';
}

/**
 * Фильтрация туров по минимальному баллу соответствия
 */
export function filterToursByMatch(
  tours: TourWithParameters[],
  profile: Partial<Profile>,
  minScore: number = 6,
  userQuery?: string
): MatchResult[] {
  const results = tours.map(tour => 
    calculateTourMatch(tour, profile, userQuery)
  );
  
  return results
    .filter(result => result.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Группировка туров по типам отдыха
 */
export function groupToursByVacationType(
  matchResults: MatchResult[]
): Record<VacationType, MatchResult[]> {
  const grouped: Partial<Record<VacationType, MatchResult[]>> = {};
  
  matchResults.forEach(result => {
    result.vacationTypes.forEach(type => {
      if (!grouped[type]) {
        grouped[type] = [];
      }
      grouped[type]!.push(result);
    });
  });
  
  return grouped as Record<VacationType, MatchResult[]>;
}