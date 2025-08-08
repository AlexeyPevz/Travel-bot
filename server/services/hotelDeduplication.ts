import { TourData } from '../providers/types';
import { MiniAppHotel, MiniAppTourCard, MiniAppTourOption, MiniAppHotelImage } from '../types/miniapp';
import logger from '../utils/logger';

interface HotelMatch {
  confidence: number;
  reason: string;
}

/**
 * Сервис дедупликации отелей
 * Объединяет туры в один и тот же отель от разных провайдеров
 */
export class HotelDeduplicationService {
  
  /**
   * Нормализация названия отеля для сравнения
   */
  private normalizeHotelName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/hotel|отель|resort|резорт|spa|спа/gi, '')
      .replace(/[^\w\s\u0400-\u04FF]/g, '') // удаляем спецсимволы, оставляя буквы и цифры
      .trim();
  }
  
  /**
   * Вычисление схожести двух строк (Levenshtein distance)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const normalize = (s: string) => s.toLowerCase().trim();
    const s1 = normalize(str1);
    const s2 = normalize(str2);
    
    if (s1 === s2) return 1;
    
    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0 || len2 === 0) return 0;
    
    const matrix: number[][] = [];
    
    for (let i = 0; i <= len2; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= len1; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= len2; i++) {
      for (let j = 1; j <= len1; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return 1 - distance / maxLen;
  }
  
  /**
   * Проверка, являются ли два отеля одним и тем же
   */
  private isMatchingHotel(tour1: TourData, tour2: TourData): HotelMatch {
    // 1. Проверка по координатам (если есть)
    if (tour1.latitude && tour1.longitude && tour2.latitude && tour2.longitude) {
      const distance = this.calculateGeoDistance(
        tour1.latitude, tour1.longitude,
        tour2.latitude, tour2.longitude
      );
      
      // Если отели находятся в радиусе 500 метров - скорее всего это один отель
      if (distance < 0.5) {
        const nameSimilarity = this.calculateSimilarity(tour1.hotel, tour2.hotel);
        if (nameSimilarity > 0.5) {
          return { confidence: 0.95, reason: 'coordinates_match' };
        }
      }
    }
    
    // 2. Проверка по нормализованному названию
    const norm1 = this.normalizeHotelName(tour1.hotel);
    const norm2 = this.normalizeHotelName(tour2.hotel);
    
    if (norm1 === norm2) {
      return { confidence: 0.9, reason: 'exact_name_match' };
    }
    
    // 3. Проверка схожести названий
    const nameSimilarity = this.calculateSimilarity(tour1.hotel, tour2.hotel);
    
    // 4. Дополнительные проверки
    const sameStars = tour1.hotelStars === tour2.hotelStars;
    const sameCity = tour1.destination === tour2.destination || 
                    tour1.arrivalCity === tour2.arrivalCity;
    
    // Высокая схожесть названия + совпадение звезд и города
    if (nameSimilarity > 0.8 && sameStars && sameCity) {
      return { confidence: 0.85, reason: 'high_similarity' };
    }
    
    // Средняя схожесть но все остальное совпадает
    if (nameSimilarity > 0.7 && sameStars && sameCity) {
      // Проверяем дополнительные признаки
      const beachMatch = tour1.beachDistance && tour2.beachDistance && 
                        Math.abs(tour1.beachDistance - tour2.beachDistance) < 100;
      
      if (beachMatch) {
        return { confidence: 0.75, reason: 'medium_similarity_with_features' };
      }
    }
    
    return { confidence: 0, reason: 'no_match' };
  }
  
  /**
   * Расчет расстояния между координатами в км
   */
  private calculateGeoDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Радиус Земли в км
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  
  /**
   * Объединение информации об отеле из разных источников
   */
  private mergeHotelInfo(tours: TourData[]): MiniAppHotel {
    // Выбираем самую полную информацию из всех источников
    const primaryTour = tours.reduce((best, current) => {
      const bestScore = (best.description?.length || 0) + (best.images?.length || 0) + (best.rating ? 10 : 0);
      const currentScore = (current.description?.length || 0) + (current.images?.length || 0) + (current.rating ? 10 : 0);
      return currentScore > bestScore ? current : best;
    });
    
    // Собираем все изображения
    const allImages = new Set<string>();
    tours.forEach(tour => {
      if (tour.image) allImages.add(tour.image);
      tour.images?.forEach(img => allImages.add(img));
    });
    
    // Преобразуем изображения в формат MiniApp
    const images: MiniAppHotelImage[] = Array.from(allImages).slice(0, 10).map(url => ({
      thumb: url.replace(/\.(jpg|jpeg|png)$/i, '_150x150.$1'),
      medium: url.replace(/\.(jpg|jpeg|png)$/i, '_500x300.$1'),
      large: url,
      alt: primaryTour.hotel
    }));
    
    // Определяем лучший рейтинг
    const bestRating = Math.max(...tours.map(t => t.rating || 0));
    const totalReviews = tours.reduce((sum, t) => sum + (t.reviewsCount || 0), 0);
    
    // Определяем особенности пляжа
    const beachInfo = tours.find(t => t.beachDistance !== null);
    
    return {
      id: `hotel_${this.generateHotelId(primaryTour)}`,
      name: primaryTour.hotel,
      stars: primaryTour.hotelStars || 0,
      
      location: {
        country: primaryTour.destination,
        countryCode: this.getCountryCode(primaryTour.destination),
        city: primaryTour.arrivalCity || primaryTour.destination,
        coordinates: {
          lat: primaryTour.latitude || 0,
          lng: primaryTour.longitude || 0
        },
        distances: {
          airport: primaryTour.airportDistance || undefined,
          beach: primaryTour.beachDistance || undefined
        }
      },
      
      images,
      
      description: {
        short: primaryTour.description?.substring(0, 200) || '',
        full: primaryTour.description || '',
        highlights: this.extractHighlights(tours)
      },
      
      rating: {
        overall: bestRating
      },
      
      reviews: {
        count: totalReviews,
        score: bestRating
      },
      
      features: {
        wifi: primaryTour.hasWifi || false,
        pool: primaryTour.hasPool || false,
        beach: beachInfo ? {
          distance: beachInfo.beachDistance || 0,
          type: (beachInfo.beachType as any) || 'sand',
          surface: beachInfo.beachSurface,
          firstLine: (beachInfo.beachDistance || 0) < 100,
          private: false
        } : {
          distance: 1000,
          type: 'sand',
          firstLine: false,
          private: false
        },
        kidsClub: primaryTour.hasKidsClub || false,
        fitness: primaryTour.hasFitness || false,
        spa: false,
        restaurant: 1,
        bars: 1,
        parking: false,
        airConditioner: true,
        elevator: false,
        accessible: false
      },
      
      roomTypes: [{
        id: 'standard',
        name: 'Стандартный номер',
        capacity: { adults: 2, children: 2 },
        amenities: []
      }],
      
      policies: {
        checkIn: '14:00',
        checkOut: '12:00',
        childrenAllowed: true,
        petsAllowed: false,
        smokingAllowed: false
      },
      
      tags: this.generateTags(tours)
    };
  }
  
  /**
   * Преобразование тура в опцию для MiniApp
   */
  private tourToOption(tour: TourData): MiniAppTourOption {
    return {
      id: tour.externalId,
      provider: tour.provider,
      tourOperator: tour.tourOperatorId || tour.provider,
      
      price: tour.price,
      priceOld: tour.priceOld || undefined,
      currency: 'RUB',
      pricePerPerson: Math.round(tour.price / 2),
      priceIncludes: ['Перелет', 'Проживание', tour.mealType].filter(Boolean),
      
      startDate: tour.startDate.toISOString(),
      endDate: tour.endDate.toISOString(),
      nights: tour.nights,
      
      room: {
        id: 'standard',
        name: tour.roomType || 'Стандартный номер',
        capacity: { adults: 2, children: 2 },
        amenities: []
      },
      
      meal: {
        code: this.getMealCode(tour.mealType),
        name: tour.mealType,
        included: this.getMealIncludes(tour.mealType)
      },
      
      transfer: true,
      insurance: false,
      instantConfirm: tour.instantConfirm || false,
      
      bookingLink: tour.link,
      
      lastUpdated: new Date().toISOString(),
      availability: tour.availability as any || 'available'
    };
  }
  
  /**
   * Группировка туров по отелям
   */
  public groupToursByHotel(tours: TourData[]): MiniAppTourCard[] {
    const hotelGroups = new Map<string, TourData[]>();
    const processed = new Set<number>();
    
    // Группируем туры по отелям
    tours.forEach((tour, index) => {
      if (processed.has(index)) return;
      
      const group: TourData[] = [tour];
      processed.add(index);
      
      // Ищем похожие отели
      tours.forEach((otherTour, otherIndex) => {
        if (processed.has(otherIndex)) return;
        
        const match = this.isMatchingHotel(tour, otherTour);
        if (match.confidence > 0.7) {
          group.push(otherTour);
          processed.add(otherIndex);
          
          logger.info('Hotel match found', {
            hotel1: tour.hotel,
            hotel2: otherTour.hotel,
            confidence: match.confidence,
            reason: match.reason
          });
        }
      });
      
      const hotelKey = this.generateHotelId(tour);
      hotelGroups.set(hotelKey, group);
    });
    
    // Преобразуем группы в карточки
    const cards: MiniAppTourCard[] = [];
    
    hotelGroups.forEach((group) => {
      const hotel = this.mergeHotelInfo(group);
      const options = group.map(tour => this.tourToOption(tour));
      
      // Сортируем опции по цене
      options.sort((a, b) => a.price - b.price);
      
      const priceRange = {
        min: Math.min(...options.map(o => o.price)),
        max: Math.max(...options.map(o => o.price)),
        currency: 'RUB'
      };
      
      // Определяем лучшие предложения
      const bestPrice = options[0]; // самый дешевый
      const bestValue = this.findBestValue(options);
      const recommended = this.findRecommended(options);
      
      const card: MiniAppTourCard = {
        hotel,
        options,
        priceRange,
        bestPrice,
        bestValue,
        recommended,
        matchScore: group[0].matchScore,
        badges: this.generateBadges(group, options)
      };
      
      cards.push(card);
    });
    
    // Сортируем карточки по релевантности
    cards.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    
    return cards;
  }
  
  /**
   * Генерация уникального ID отеля
   */
  private generateHotelId(tour: TourData): string {
    const parts = [
      this.normalizeHotelName(tour.hotel),
      tour.hotelStars || 0,
      tour.destination.toLowerCase()
    ];
    
    return parts.join('_').replace(/\s+/g, '_');
  }
  
  /**
   * Извлечение ключевых особенностей отеля
   */
  private extractHighlights(tours: TourData[]): string[] {
    const highlights: string[] = [];
    
    const hasBeach = tours.some(t => t.beachDistance !== null && t.beachDistance < 500);
    if (hasBeach) {
      const minDistance = Math.min(...tours.map(t => t.beachDistance || Infinity));
      if (minDistance < 100) highlights.push('Первая линия пляжа');
      else highlights.push(`${minDistance}м до пляжа`);
    }
    
    if (tours.some(t => t.hasWifi)) highlights.push('Бесплатный Wi-Fi');
    if (tours.some(t => t.hasPool)) highlights.push('Бассейн');
    if (tours.some(t => t.hasKidsClub)) highlights.push('Детский клуб');
    if (tours.some(t => t.hasFitness)) highlights.push('Фитнес-центр');
    if (tours.some(t => t.hasAquapark)) highlights.push('Аквапарк');
    
    return highlights;
  }
  
  /**
   * Генерация тегов для отеля
   */
  private generateTags(tours: TourData[]): string[] {
    const tags: string[] = [];
    
    if (tours.some(t => t.hasKidsClub || t.hasAquapark)) {
      tags.push('Семейный');
    }
    
    if (tours.some(t => t.hotelStars && t.hotelStars >= 5)) {
      tags.push('Люкс');
    }
    
    if (tours.some(t => t.beachDistance !== null && t.beachDistance < 100)) {
      tags.push('Пляжный');
    }
    
    if (tours.some(t => t.isHot)) {
      tags.push('Горящий тур');
    }
    
    return tags;
  }
  
  /**
   * Генерация бейджей для карточки
   */
  private generateBadges(tours: TourData[], options: MiniAppTourOption[]): any[] {
    const badges: any[] = [];
    
    if (tours.some(t => t.isHot)) {
      badges.push({ type: 'hot', text: 'Горящий тур', color: '#ff4444' });
    }
    
    const discounts = options.filter(o => o.priceOld && o.priceOld > o.price);
    if (discounts.length > 0) {
      const maxDiscount = Math.max(...discounts.map(o => 
        Math.round((1 - o.price / (o.priceOld || o.price)) * 100)
      ));
      badges.push({ type: 'discount', text: `-${maxDiscount}%`, color: '#44ff44' });
    }
    
    if (options.every(o => o.instantConfirm)) {
      badges.push({ type: 'exclusive', text: 'Моментальное подтверждение', color: '#4444ff' });
    }
    
    return badges;
  }
  
  /**
   * Поиск лучшего соотношения цена/качество
   */
  private findBestValue(options: MiniAppTourOption[]): MiniAppTourOption {
    return options.reduce((best, current) => {
      const bestScore = this.calculateValueScore(best);
      const currentScore = this.calculateValueScore(current);
      return currentScore > bestScore ? current : best;
    });
  }
  
  /**
   * Вычисление оценки соотношения цена/качество
   */
  private calculateValueScore(option: MiniAppTourOption): number {
    let score = 100;
    
    // Базовая оценка по цене (инвертированная)
    score = score / (option.price / 10000);
    
    // Бонусы за включенные услуги
    if (option.meal.code === 'AI' || option.meal.code === 'UAI') score += 20;
    if (option.meal.code === 'FB') score += 10;
    if (option.transfer) score += 10;
    if (option.insurance) score += 5;
    if (option.instantConfirm) score += 15;
    
    return score;
  }
  
  /**
   * Выбор рекомендованного варианта
   */
  private findRecommended(options: MiniAppTourOption[]): MiniAppTourOption {
    // Логика может быть расширена с учетом предпочтений пользователя
    // Пока выбираем вариант с лучшим соотношением цена/качество
    return this.findBestValue(options);
  }
  
  /**
   * Получение кода страны по названию
   */
  private getCountryCode(country: string): string {
    const codes: Record<string, string> = {
      'Турция': 'TR',
      'Египет': 'EG',
      'ОАЭ': 'AE',
      'Таиланд': 'TH',
      'Греция': 'GR',
      'Кипр': 'CY',
      'Испания': 'ES',
      'Италия': 'IT',
      'Болгария': 'BG',
      'Черногория': 'ME'
    };
    
    return codes[country] || 'XX';
  }
  
  /**
   * Преобразование типа питания в код
   */
  private getMealCode(mealType: string): 'RO' | 'BB' | 'HB' | 'FB' | 'AI' | 'UAI' {
    const mapping: Record<string, 'RO' | 'BB' | 'HB' | 'FB' | 'AI' | 'UAI'> = {
      'Без питания': 'RO',
      'Завтрак': 'BB',
      'Полупансион': 'HB',
      'Полный пансион': 'FB',
      'Все включено': 'AI',
      'Ультра все включено': 'UAI'
    };
    
    return mapping[mealType] || 'RO';
  }
  
  /**
   * Получение описания включенного в тип питания
   */
  private getMealIncludes(mealType: string): string[] {
    const includes: Record<string, string[]> = {
      'Без питания': [],
      'Завтрак': ['Завтрак'],
      'Полупансион': ['Завтрак', 'Ужин'],
      'Полный пансион': ['Завтрак', 'Обед', 'Ужин'],
      'Все включено': ['Завтрак', 'Обед', 'Ужин', 'Напитки', 'Снеки'],
      'Ультра все включено': ['Завтрак', 'Обед', 'Ужин', 'Премиум напитки', 'Снеки', 'А-ля карт рестораны']
    };
    
    return includes[mealType] || [];
  }
}

// Экспортируем singleton
export const hotelDeduplicationService = new HotelDeduplicationService();