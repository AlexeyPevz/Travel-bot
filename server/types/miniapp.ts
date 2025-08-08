/**
 * Типы данных для Mini App
 * Оптимизированы для красивого отображения и быстрой загрузки
 */

export interface MiniAppHotelImage {
  thumb: string;  // 150x150
  medium: string; // 500x300
  large: string;  // 1200x800
  alt?: string;
}

export interface MiniAppHotelFeatures {
  wifi: boolean | 'free' | 'paid';
  pool: boolean | { indoor: boolean; outdoor: boolean; heated: boolean };
  beach: {
    distance: number; // в метрах
    type: 'sand' | 'pebble' | 'platform' | 'mixed';
    surface?: string;
    firstLine: boolean;
    private: boolean;
  };
  kidsClub: boolean | { minAge?: number; maxAge?: number; };
  fitness: boolean;
  spa: boolean;
  restaurant: number; // количество ресторанов
  bars: number;
  parking: boolean | 'free' | 'paid';
  airConditioner: boolean;
  elevator: boolean;
  accessible: boolean; // для людей с ограниченными возможностями
}

export interface MiniAppRoomType {
  id: string;
  name: string;
  capacity: {
    adults: number;
    children: number;
    infants?: number;
  };
  size?: number; // кв.м
  view?: 'sea' | 'garden' | 'pool' | 'city' | 'mountain';
  amenities: string[];
}

export interface MiniAppMealType {
  code: 'RO' | 'BB' | 'HB' | 'FB' | 'AI' | 'UAI';
  name: string;
  description?: string;
  included: string[];
}

export interface MiniAppTourOption {
  id: string;
  provider: string;
  providerLogo?: string;
  tourOperator: string;
  tourOperatorLogo?: string;
  
  // Цены
  price: number;
  priceOld?: number;
  currency: string;
  pricePerPerson?: number;
  priceIncludes: string[];
  
  // Даты и продолжительность
  startDate: string;
  endDate: string;
  nights: number;
  
  // Перелет
  flight?: {
    outbound: {
      airline: string;
      flightNumber: string;
      departure: { time: string; airport: string; terminal?: string };
      arrival: { time: string; airport: string; terminal?: string };
      duration: number; // минуты
      stops: number;
    };
    return: {
      airline: string;
      flightNumber: string;
      departure: { time: string; airport: string; terminal?: string };
      arrival: { time: string; airport: string; terminal?: string };
      duration: number;
      stops: number;
    };
    baggage?: {
      cabin: string;
      checked: string;
    };
  };
  
  // Проживание
  room: MiniAppRoomType;
  meal: MiniAppMealType;
  
  // Дополнительно
  transfer: boolean | 'group' | 'individual';
  insurance: boolean | 'medical' | 'full';
  instantConfirm: boolean;
  cancellationPolicy?: string;
  
  // Ссылки
  bookingLink: string;
  detailsLink?: string;
  
  // Метаданные
  lastUpdated: string;
  availability: 'available' | 'on_request' | 'few_left' | 'sold_out';
}

export interface MiniAppHotel {
  id: string;
  name: string;
  stars: number;
  
  // Локация
  location: {
    country: string;
    countryCode: string;
    city: string;
    region?: string;
    address?: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    distances: {
      airport?: number;
      cityCenter?: number;
      beach?: number;
      nearestTown?: number;
    };
  };
  
  // Медиа
  images: MiniAppHotelImage[];
  video?: string;
  virtualTour?: string;
  
  // Описания
  description: {
    short: string; // до 200 символов
    full: string;
    highlights?: string[]; // ключевые особенности
  };
  
  // Рейтинги и отзывы
  rating: {
    overall: number;
    cleanliness?: number;
    location?: number;
    service?: number;
    value?: number;
  };
  reviews: {
    count: number;
    score: number;
    lastReview?: string;
    topReviews?: Array<{
      author: string;
      date: string;
      rating: number;
      text: string;
      pros?: string;
      cons?: string;
    }>;
  };
  
  // Удобства
  features: MiniAppHotelFeatures;
  
  // Типы номеров (общая информация)
  roomTypes: MiniAppRoomType[];
  
  // Важная информация
  policies: {
    checkIn: string;
    checkOut: string;
    childrenAllowed: boolean;
    petsAllowed: boolean;
    smokingAllowed: boolean;
    paymentMethods?: string[];
  };
  
  // Дополнительная информация
  tags?: string[]; // ['Семейный', 'Романтический', 'Для молодоженов']
  awards?: string[];
  lastRenovation?: number; // год
  totalRooms?: number;
  floors?: number;
  
  // SEO и метаданные
  meta?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
}

export interface MiniAppTourCard {
  hotel: MiniAppHotel;
  options: MiniAppTourOption[]; // варианты от разных провайдеров
  
  // Агрегированные данные
  priceRange: {
    min: number;
    max: number;
    currency: string;
  };
  
  // Лучшие предложения
  bestPrice?: MiniAppTourOption;
  bestValue?: MiniAppTourOption; // лучшее соотношение цена/качество
  recommended?: MiniAppTourOption; // наша рекомендация
  
  // Фильтры и сортировка
  matchScore?: number; // релевантность поисковому запросу
  popularity?: number; // на основе просмотров и бронирований
  
  // Метки
  badges?: Array<{
    type: 'hot' | 'new' | 'discount' | 'lastminute' | 'earlybird' | 'exclusive';
    text: string;
    color?: string;
  }>;
}

export interface MiniAppSearchFilters {
  priceRange?: { min: number; max: number };
  stars?: number[];
  meals?: string[];
  features?: string[];
  roomTypes?: string[];
  providers?: string[];
  tourOperators?: string[];
  instantConfirm?: boolean;
  beachLine?: number; // 1, 2, 3
  rating?: number; // минимальный рейтинг
  withFlight?: boolean;
  withTransfer?: boolean;
}

export interface MiniAppSearchResults {
  query: {
    destination: string;
    startDate: string;
    endDate: string;
    adults: number;
    children: number;
    childrenAges?: number[];
  };
  
  results: MiniAppTourCard[];
  
  totalCount: number;
  filters: MiniAppSearchFilters;
  appliedFilters?: MiniAppSearchFilters;
  
  facets: {
    priceHistogram: Array<{ range: string; count: number }>;
    stars: Array<{ value: number; count: number }>;
    meals: Array<{ value: string; count: number; name: string }>;
    features: Array<{ value: string; count: number; name: string }>;
    providers: Array<{ value: string; count: number; name: string }>;
  };
  
  sorting: {
    current: 'price' | 'rating' | 'popularity' | 'match';
    available: string[];
  };
  
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface MiniAppUserPreferences {
  currency: string;
  language: string;
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    priceDrops: boolean;
    newTours: boolean;
    recommendations: boolean;
  };
  savedFilters?: MiniAppSearchFilters;
  recentSearches?: Array<{
    query: MiniAppSearchResults['query'];
    timestamp: string;
  }>;
  favoriteHotels?: string[];
  viewedTours?: Array<{
    hotelId: string;
    timestamp: string;
  }>;
}