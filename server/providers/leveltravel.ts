import axios from 'axios';
import { TourData, TourSearchParams } from './index';
import { retry, RetryStrategies } from '../utils/retry';
import { ExternalServiceError } from '../utils/errors';
import logger from '../utils/logger';

// Расширенный интерфейс для ошибок с информацией о провайдере
interface ProviderError extends Error {
  provider?: string;
}

/**
 * Партнерская ссылка для Level.Travel
 * Это реальная партнерская ссылка для редиректа на Level.Travel
 */
const LEVEL_TRAVEL_PARTNER_ID = process.env.LEVEL_TRAVEL_PARTNER || process.env.LEVELTRAVEL_PARTNER || '627387';
const LEVEL_TRAVEL_REFERRAL_URL = `https://level.travel/?ref=${LEVEL_TRAVEL_PARTNER_ID}`;

/**
 * URL базового API Level.Travel
 */
const LEVEL_TRAVEL_API_URL = 'https://api.level.travel';

/**
 * Country codes mapping for Level.Travel API
 */
const COUNTRY_CODES: Record<string, string> = {
  'турция': 'TR',
  'египет': 'EG',
  'кипр': 'CY',
  'оаэ': 'AE',
  'таиланд': 'TH',
  'индонезия': 'ID',
  'тунис': 'TN',
  'греция': 'GR',
  'испания': 'ES',
  'италия': 'IT',
  'мальдивы': 'MV',
  'танзания': 'TZ',
  'доминикана': 'DO',
  'мексика': 'MX',
  'куба': 'CU',
  'россия': 'RU',
  'абхазия': 'ABH'
};

/**
 * Meal type mapping for Level.Travel API
 */
const MEAL_TYPES: Record<string, string> = {
  'ro': 'НЕТ - Без питания',
  'bb': 'ЗАВТРАК - Только завтрак (Bed & Breakfast)',
  'hb': 'ПОЛУПАНСИОН - Завтрак и ужин (Half Board)',
  'fb': 'ПОЛНЫЙ ПАНСИОН - Завтрак, обед и ужин (Full Board)',
  'ai': 'ВСЁ ВКЛЮЧЕНО - All Inclusive',
  'uai': 'УЛЬТРА ВСЁ ВКЛЮЧЕНО - Ultra All Inclusive',
  'non': 'НЕТ - Без питания',
  'no_meals': 'НЕТ - Без питания',
  'all': 'ВСЁ ВКЛЮЧЕНО - All Inclusive',
  'all_incl': 'ВСЁ ВКЛЮЧЕНО - All Inclusive',
  'all_inclusive': 'ВСЁ ВКЛЮЧЕНО - All Inclusive',
  'ultra_all': 'УЛЬТРА ВСЁ ВКЛЮЧЕНО - Ultra All Inclusive',
  'ultra_all_inclusive': 'УЛЬТРА ВСЁ ВКЛЮЧЕНО - Ultra All Inclusive',
  'half': 'ПОЛУПАНСИОН - Завтрак и ужин (Half Board)',
  'half_board': 'ПОЛУПАНСИОН - Завтрак и ужин (Half Board)',
  'full': 'ПОЛНЫЙ ПАНСИОН - Завтрак, обед и ужин (Full Board)',
  'full_board': 'ПОЛНЫЙ ПАНСИОН - Завтрак, обед и ужин (Full Board)',
  'breakfast': 'ЗАВТРАК - Только завтрак (Bed & Breakfast)',
  'breakfasts': 'ЗАВТРАК - Только завтрак (Bed & Breakfast)',
  'bed_and_breakfast': 'ЗАВТРАК - Только завтрак (Bed & Breakfast)'
};

function formatDate(date: Date): string {
  if (!date || isNaN(date.getTime())) return '';
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

function parseMealType(mealType: string): string {
  if (!mealType) return 'Питание по программе';
  const normalizedType = mealType.toLowerCase().trim();
  if (MEAL_TYPES[normalizedType]) return MEAL_TYPES[normalizedType];
  for (const key in MEAL_TYPES) {
    if (normalizedType.includes(key)) return MEAL_TYPES[key];
  }
  if (normalizedType.length > 5) return mealType;
  return 'Питание по программе';
}

function enhanceImageQuality(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  let enhancedUrl = imageUrl;
  if (enhancedUrl.includes('?')) enhancedUrl = enhancedUrl.split('?')[0];
  if (enhancedUrl.includes('/800x600/')) enhancedUrl = enhancedUrl.replace('/800x600/', '/1600x1200/');
  if (enhancedUrl.includes('/400x300/')) enhancedUrl = enhancedUrl.replace('/400x300/', '/1600x1200/');
  if (enhancedUrl.includes('/200x150/')) enhancedUrl = enhancedUrl.replace('/200x150/', '/1600x1200/');
  if (enhancedUrl.startsWith('http://')) enhancedUrl = enhancedUrl.replace('http://', 'https://');
  return enhancedUrl;
}

function createReferralLink(hotelId: string | number, params?: any): string {
  const affiliateUrl = process.env.LEVEL_TRAVEL_AFFILIATE_URL;
  const marker = process.env.LEVEL_TRAVEL_MARKER || '627387';
  if (affiliateUrl && affiliateUrl.includes('level.tpx.lt')) {
    const urlParams = new URLSearchParams({ hotel_id: hotelId.toString(), marker });
    if (params) {
      if (params.start_date) urlParams.append('start_date', params.start_date);
      if (params.nights) urlParams.append('nights', params.nights.toString());
      if (params.adults) urlParams.append('adults', params.adults.toString());
      if (params.kids) urlParams.append('kids', params.kids.toString());
    }
    return `${affiliateUrl}&${urlParams.toString()}`;
  }
  if (!hotelId) return `https://level.travel/?partner_id=${LEVEL_TRAVEL_PARTNER_ID}`;
  return `https://level.travel/hotels/${hotelId}?partner_id=${LEVEL_TRAVEL_PARTNER_ID}`;
}

function createLevelTravelHeaders(apiKey: string) {
  return {
    'Authorization': `Token token="${apiKey}"`,
    'Accept': 'application/vnd.leveltravel.v3',
    'Content-Type': 'application/json',
    'X-API-Version': '3'
  };
}

function isWifiFree(features: any): boolean {
  const v = features?.wi_f_i ?? features?.wi_fi;
  return String(v).toUpperCase() === 'FREE';
}

/**
 * Стандартизирует и обогащает данные об отеле, сохраняя исходный формат API Level.Travel
 * и преобразуя их в формат, понятный нашему приложению
 * 
 * @param hotelData Исходные данные об отеле из API Level.Travel
 * @returns Стандартизированные данные об отеле
 */
function standardizeHotelData(hotelData: any): any {
  if (!hotelData) return null;
  
  // Отладочная информация: показываем структуру данных
  // console.log(`HotelDetails.photos:`, hotelData.photos);
  
  // По документации Level.Travel API:
  // Изображения отеля хранятся в поле 'images' как массив объектов {id, url}
  // Обрабатываем фотографии строго в соответствии с документацией
  
  let processedPhotos: {url: string}[] = [];
  
  // Обработка photos (в некоторых ответах API)
  if (hotelData.photos && Array.isArray(hotelData.photos)) {
    // console.log(`Найдено ${hotelData.photos.length} фото в поле photos`);
    
    // Преобразуем в массив объектов {url: "..."}
    const extractedUrls = hotelData.photos.map((photo: any) => {
      if (typeof photo === 'string') {
        return { url: enhanceImageQuality(photo) };
      } else if (photo && typeof photo === 'object') {
        const url = photo.url || photo.link || '';
        if (url) {
          return { url: enhanceImageQuality(url) };
        }
      }
      return null;
    }).filter(Boolean);
    
    processedPhotos = [...processedPhotos, ...extractedUrls];
    // console.log(`Извлечено ${extractedUrls.length} URL из photos`);
  }
  
  // Обработка images (в соответствии с документацией Level.Travel)
  if (hotelData.images && Array.isArray(hotelData.images)) {
    // console.log(`Найдено ${hotelData.images.length} фото в поле images`);
    
    // Преобразуем в массив объектов {url: "..."}
    const extractedUrls = hotelData.images.map((image: any) => {
      if (typeof image === 'string') {
        return { url: enhanceImageQuality(image) };
      } else if (image && typeof image === 'object') {
        const url = image.url || '';
        if (url) {
          return { url: enhanceImageQuality(url) };
        }
      }
      return null;
    }).filter(Boolean);
    
    processedPhotos = [...processedPhotos, ...extractedUrls];
    // console.log(`Извлечено ${extractedUrls.length} URL из images`);
  }
    
  // Добавляем image_url если оно есть (в некоторых форматах Level.Travel API)
  if (hotelData.image_url) {
    const url = enhanceImageQuality(hotelData.image_url);
    if (url) {
      // Добавляем в начало списка как основное изображение
      processedPhotos.unshift({ url });
      // console.log(`Добавлено основное изображение из image_url`);
    }
  }
  
  // Проверка на основное изображение в поле image (объект)
  if (hotelData.image && typeof hotelData.image === 'object' && hotelData.image.url) {
    const url = enhanceImageQuality(hotelData.image.url);
    if (url) {
      processedPhotos.unshift({ url });
      // console.log(`Добавлено основное изображение из объекта image`);
    }
  }
  
  // Удаляем дубликаты по URL
  const uniqueUrls = new Set<string>();
  const uniquePhotos = processedPhotos.filter(photo => {
    if (uniqueUrls.has(photo.url)) {
      return false;
    }
    uniqueUrls.add(photo.url);
    return true;
  });
  
  // console.log(`Итого обработано ${uniquePhotos.length} фотографий`);
  
  // Получаем данные об отеле и его особенностях из всех источников
  const features = hotelData.features || {};
  const rawData = hotelData.search_data || hotelData.raw_data || {};
  
  // Проверяем перелеты из raw_data или search_data
  const flights = (rawData.flight || rawData.flights || hotelData.flights) || {};

  // Создаем стандартизированный объект отеля
  const standardizedHotel = {
    // Базовая информация
    id: hotelData.id,
    name: hotelData.name,
    title: hotelData.name,
    description: hotelData.description || hotelData.desc || hotelData.hotel_info || '',
    stars: hotelData.stars || 0,
    rating: hotelData.rating || 0,
    address: hotelData.address || '',
    latitude: hotelData.lat || hotelData.latitude || 0,
    longitude: hotelData.long || hotelData.longitude || 0,
    
    // Ссылки
    public_url: hotelData.public_url || '',
    site_url: hotelData.site_url || '',
    
    // Изображения - строго в формате массива {url: "..."} для согласованности
    photos: uniquePhotos,
    
    // Информация об особенностях отеля в соответствии с документацией API Level.Travel
    features: features,
    attractions: hotelData.attractions || [],
    kids_facilities: hotelData.kids_facilities || [],
    room_facilities: hotelData.room_facilities || [],
    territory: hotelData.territory || [],
    
    // Расстояния и возраст отеля
    beachDistance: features.beach_distance || null,
    cityDistance: features.city_distance || null,
    airportDistance: features.airport_distance || null,
    constructionYear: features.construction_year || null,
    renovationYear: features.renovation_year || null,
    
    // Информация о перелетах, чтобы отобразить на странице отеля
    departureAirport: flights.departureAirport || flights.departure_airport || 
                     (rawData.departure && rawData.departure.airport ? rawData.departure.airport.code : null),
    departureCity: flights.departureCity || flights.departure_city || 
                  (rawData.departure && rawData.departure.city ? rawData.departure.city.name_ru : null),
    arrivalAirport: flights.arrivalAirport || flights.arrival_airport || 
                   (rawData.arrival && rawData.arrival.airport ? rawData.arrival.airport.code : null),
    arrivalCity: flights.arrivalCity || flights.arrival_city || 
                (rawData.arrival && rawData.arrival.city ? rawData.arrival.city.name_ru : null),
    airline: flights.airline || (Array.isArray(rawData.airlines) && rawData.airlines.length > 0 
              ? rawData.airlines[0].name : null),
    
    // Исходные данные для отладки
    raw_data: rawData
  };
  
  // Собираем все изображения для удобства клиенту
  const images = uniquePhotos.map(photo => photo.url);
  
  // Комбинируем полученные данные и возвращаем
  const combinedHotel = {
    ...standardizedHotel,
    // Запасное изображение, если нет фотографий
    image: uniquePhotos.length > 0 ? uniquePhotos[0].url : null,
    // Все URL изображений
    images: images
  };
  
  // Логируем комбинированную информацию
  // console.log(`Найден отель в API и базе данных: ${combinedHotel.name}`);
  // console.log(`Комбинированный источник: итого собрано ${uniquePhotos.length} фотографий`);
  
  // if (uniquePhotos.length > 0) {
  //   console.log(`Первое фото: ${uniquePhotos[0].url}`);
  // }
  
  // if (combinedHotel.airportDistance) {
  //   console.log(`Скомбинированы данные отеля: ${uniquePhotos.length} фото, расстояние до аэропорта: ${combinedHotel.airportDistance}м`);
  // }
  
  return combinedHotel;
}

/**
 * Получает детальную информацию об отеле с дополнительными данными и фотографиями
 * от API Level.Travel строго в соответствии с документацией API
 * 
 * @param hotelId ID отеля в системе Level.Travel
 * @returns Расширенные данные об отеле или null в случае ошибки
 */
export async function fetchHotelDetails(hotelId: string | number): Promise<any> {
  try {
    // Получаем API ключ
    const apiKey = process.env.LEVELTRAVEL_API_KEY;
    if (!apiKey) {
      logger.error("Level.Travel API key is not set");
      return null;
    }

    // Создаем заголовки авторизации
    const headers = createLevelTravelHeaders(apiKey);
    
    // СТРОГО ПО ДОКУМЕНТАЦИИ:
    // 1. Получаем информацию об отеле через references/hotels с параметром hotel_ids
    const url = `${LEVEL_TRAVEL_API_URL}/references/hotels`;
    // console.log(`Запрашиваем детали отеля с ID ${hotelId} из API Level.Travel`);
    
    const response = await axios.get(url, { 
      params: { hotel_ids: hotelId },
      headers
    });
    
    // Проверяем успешность запроса
    if (response.status !== 200 || !response.data.success) {
      logger.error(`Ошибка при запросе отеля ${hotelId}: ${response.status}`);
      return null;
    }
    
    // Проверяем наличие отеля в ответе
    if (!response.data.hotels || !response.data.hotels.length) {
      logger.error(`Отель с ID ${hotelId} не найден в API`);
      return null;
    }
    
    // Получаем отель из ответа API
    const hotel = response.data.hotels[0];
    // console.log(`Найден отель ${hotel.name} по API reference/hotels`);
    
    // 2. Также по документации, для получения более полных данных 
    // следует использовать hotel_dump - выгрузка всей отельной базы
    try {
      const dumpUrl = `${LEVEL_TRAVEL_API_URL}/references/hotel_dump`;
      const dumpResponse = await axios.get(dumpUrl, { headers });
      
      if (dumpResponse.status === 200 && dumpResponse.data && dumpResponse.data.link) {
        // Получаем данные по временной ссылке из dump
        try {
          const hotelDumpResponse = await axios.get(dumpResponse.data.link);
          
          if (hotelDumpResponse.status === 200 && Array.isArray(hotelDumpResponse.data)) {
            // Ищем нужный отель в массиве
            const dumpHotel = hotelDumpResponse.data.find((h: any) => 
              h.id.toString() === hotelId.toString());
            
            if (dumpHotel) {
              // console.log(`Найден отель в выгрузке hotel_dump: ${dumpHotel.name}`);
              
              // Обогащаем наш отель дополнительными данными из dump
              // images: Список объектов {id, url} - В документации, раздел "Отели (выгрузка)"
              if (dumpHotel.images && Array.isArray(dumpHotel.images)) {
                hotel.images = dumpHotel.images;
                // console.log(`Получено ${dumpHotel.images.length} изображений из dump`);
              }
              
              // Копируем другие поля по документации
              if (dumpHotel.features) hotel.features = dumpHotel.features;
              if (dumpHotel.attractions) hotel.attractions = dumpHotel.attractions;
              if (dumpHotel.kids_facilities) hotel.kids_facilities = dumpHotel.kids_facilities;
              if (dumpHotel.room_facilities) hotel.room_facilities = dumpHotel.room_facilities;
              if (dumpHotel.territory) hotel.territory = dumpHotel.territory;
              if (dumpHotel.hotel_info) hotel.description = dumpHotel.hotel_info;
            }
          }
        } catch (dumpFetchError) {
          logger.error(`Ошибка при получении данных по ссылке из dump: ${(dumpFetchError as Error).message}`);
        }
      }
    } catch (dumpError) {
      logger.error(`Ошибка при получении hotel_dump: ${(dumpError as Error).message}`);
      // Это не критическая ошибка, продолжаем
    }
    
    // 3. Стандартизируем данные отеля
    const standardizedHotel = standardizeHotelData(hotel);
    
    return standardizedHotel;
  } catch (error) {
    logger.error(`Error fetching hotel details for ${hotelId}:`, (error as Error).message);
    return null;
  }
}

/**
 * Тестовая функция для проверки доступа к API Level.Travel
 * Выполняет простой пинг-запрос для проверки доступности API
 * 
 * @returns true если API доступен, false если есть проблемы с доступом
 */
async function testLevelTravelAPI(): Promise<boolean> {
  try {
    // В тестовой и дев-среде не делаем внешний пинг, считаем API доступным
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development') {
      return true;
    }

    // Получаем API ключ
    const apiKey = process.env.LEVELTRAVEL_API_KEY;
    if (!apiKey) {
      logger.error("Level.Travel API key is not set");
      return false;
    }
    
    // Создаем заголовки авторизации
    const headers = createLevelTravelHeaders(apiKey);
    
    // Пробуем получить список стран - легкий запрос для проверки подключения
    const url = `${LEVEL_TRAVEL_API_URL}/references/countries`;
    const response = await axios.get(url, { headers, timeout: 7000 });
    
    if (response.status === 200 && response.data) {
      if (response.data.success === true || (response.data.countries && Array.isArray(response.data.countries))) {
        return true;
      }
    }
    
    logger.error(`Level.Travel API ping failed: ${JSON.stringify(response.data)}`);
    return false;
  } catch (error) {
    logger.error("Level.Travel API connection error:", (error as Error).message);
    return false;
  }
}

/**
 * Получение туров от Level.Travel API
 * Проверяет подключение к API, затем делает асинхронный запрос на поиск туров
 * 
 * @param params Параметры поиска туров
 * @returns Массив данных о турах
 */
export async function fetchToursFromLevelTravel(params: TourSearchParams): Promise<TourData[]> {
  try {
    logger.info('Level.Travel: starting search');

    // Проверяем доступность API
    const isApiAvailable = await testLevelTravelAPI();
    if (!isApiAvailable) {
      const err = new Error('Level.Travel API недоступно. Проверьте ключи API.') as ProviderError;
      err.provider = 'Level.Travel';
      throw err;
    }

    // Подготавливаем данные
    const apiKey = process.env.LEVELTRAVEL_API_KEY || process.env.LEVEL_TRAVEL_API_KEY;
    if (!apiKey) {
      throw new Error('Level.Travel API key is not set');
    }
    const headers = createLevelTravelHeaders(apiKey);

    let startDate: Date, endDate: Date, nights: number;
    if (params.dateType === 'fixed' && params.startDate && params.endDate) {
      startDate = new Date(params.startDate);
      endDate = new Date(params.endDate);
      const timeDiff = endDate.getTime() - startDate.getTime();
      nights = Math.max(1, Math.round(timeDiff / (1000 * 3600 * 24)));
    } else if (params.dateType === 'flexible' && params.flexibleMonth && params.tripDuration) {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
      nights = params.tripDuration;
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + nights);
    } else {
      startDate = new Date();
      startDate.setDate(startDate.getDate() + 14);
      // Приоритет tripDuration над nights, если указана
      nights = params.tripDuration || params.nights || 7;
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + nights);
    }

    const destinationLower = (params.destination || 'Турция').toLowerCase();
    let countryCode = 'TR';
    for (const name of Object.keys(COUNTRY_CODES)) {
      if (destinationLower.includes(name)) { countryCode = COUNTRY_CODES[name]; break; }
    }

    const departureCity = params.departureCity || 'Москва';
    const departureCityMap: Record<string, string> = {
      'Москва': 'Moscow',
      'Санкт-Петербург': 'Saint Petersburg',
      'Екатеринбург': 'Ekaterinburg',
      'Новосибирск': 'Novosibirsk',
      'Казань': 'Kazan',
      'Нижний Новгород': 'Nizhny Novgorod',
      'Самара': 'Samara',
      'Краснодар': 'Krasnodar'
    };
    const fromCity = departureCityMap[departureCity] || 'Moscow';

    const requestData = {
      from_city: fromCity,
      to_country: countryCode,
      adults: params.adults || 2,
      start_date: formatDate(startDate),
      nights: `${nights}..${nights + 2}`,
      ...(params.children ? { kids: params.children } : {}),
      ...(params.childrenAges?.length ? { kids_ages: params.childrenAges } : {}),
      ...(params.budget ? { price_max: params.budget } : {})
    } as const;

    const searchUrl = `${LEVEL_TRAVEL_API_URL}/search/enqueue`;

    let enqueueResponse;
    try {
      enqueueResponse = await axios.get(`${searchUrl}?${new URLSearchParams(requestData as any).toString()}`, { headers, timeout: 15000 });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 405) {
        enqueueResponse = await axios.post(searchUrl, requestData, { headers, timeout: 15000 });
      } else {
        throw error;
      }
    }

    if (enqueueResponse.status !== 200 || !enqueueResponse.data?.request_id) {
      const err = new Error(`Ошибка при запуске поиска туров`) as ProviderError;
      err.provider = 'Level.Travel';
      throw err;
    }

    const requestId = enqueueResponse.data.request_id;
    const statusUrl = `${LEVEL_TRAVEL_API_URL}/search/status?request_id=${requestId}&show_size=true`;

    let retries = 0;
    const maxRetries = 5;
    let hotelsResponse: any;
    while (retries < maxRetries) {
      if (retries > 0) await new Promise(r => setTimeout(r, 2000 * retries));
      const statusResponse = await axios.get(statusUrl, { headers, timeout: 15000 });
      const completeness = statusResponse.data?.completeness || 0;
      const size = statusResponse.data?.size || 0;
      const operatorStatuses = statusResponse.data?.status || {};
      const allCompleted = Object.values(operatorStatuses).every((s: any) => ['completed', 'cached', 'skipped', 'no_results', 'failed', 'all_filtered'].includes(String(s)));
      const partialResults = (completeness > 30 && size > 0) || retries >= 3;
      if (allCompleted || partialResults) { hotelsResponse = statusResponse; break; }
      retries++;
    }

    if (!hotelsResponse) {
      const err = new Error('Не удалось получить результаты поиска туров: превышено время ожидания') as ProviderError;
      err.provider = 'Level.Travel';
      throw err;
    }

    const hotelsUrl = `${LEVEL_TRAVEL_API_URL}/search/get_grouped_hotels?request_id=${requestId}`;
    const hotelsListResponse = await axios.get(hotelsUrl, { headers, timeout: 20000 });
    if (!hotelsListResponse.data?.success) {
      const err = new Error(`Ошибка при получении списка отелей`) as ProviderError;
      err.provider = 'Level.Travel';
      throw err;
    }

    const result: TourData[] = [];
    const hotelsList = hotelsListResponse.data.hotels || [];
    for (const hotelData of hotelsList) {
      try {
        const hotel = hotelData.hotel;
        if (!hotel?.id) continue;
        const hotelId = hotel.id;
        const hotelName = hotel.name;
        const hotelStars = hotel.stars || 0;
        const hotelPrice = hotelData.min_price || 0;
        const hotelOldPrice = hotelData.extras?.previous_price || null;
        const hotelRating = hotel.rating || null;
        const hotelReviews = hotel.reviews_count || 0;
        const images: string[] = [];
        if (hotel.image?.full_size) images.push(hotel.image.full_size);
        if (hotel.images && Array.isArray(hotel.images)) {
          hotel.images.forEach((img: any) => { if (img.x500) images.push(img.x500); });
        }
        if (hotelId && hotelName && hotelPrice > 0) {
          const tour: TourData = {
            provider: 'leveltravel',
            externalId: `lt-${hotelId}`,
            title: `${hotelName} ${hotelStars > 0 ? hotelStars + '★' : ''}`.trim(),
            description: hotel.desc || '',
            destination: hotel.city || hotel.region_name || (params.destination as any),
            hotel: hotelName,
            hotelStars,
            price: hotelPrice,
            priceOld: hotelOldPrice || undefined,
            rating: hotelRating || undefined,
            startDate,
            endDate,
            nights,
            roomType: 'Стандартный номер',
            mealType: parseMealType(hotelData.pansion_prices ? Object.keys(hotelData.pansion_prices)[0] : ''),
            link: createReferralLink(hotelId, {
              start_date: startDate.toISOString().split('T')[0],
              nights,
              adults: params.adults || 2,
              kids: params.children || 0
            }),
            image: images[0] || undefined,
            images,
            departureCity: params.departureCity || 'Москва',
            arrivalCity: hotel.city || (params.destination as any),
            tourOperatorId: hotelData.operators?.[0] || undefined,
            beachDistance: hotel.features?.beach_distance || undefined,
            beachType: hotel.features?.beach_type || undefined,
            beachSurface: hotel.features?.beach_surface || undefined,
            airportDistance: hotel.features?.airport_distance || undefined,
            hasWifi: isWifiFree(hotel.features),
            hasPool: hotel.features?.pool || false,
            hasKidsClub: hotel.features?.kids_club || false,
            hasFitness: hotel.features?.fitness || false,
            hasAquapark: hotel.features?.aquapark || false,
            latitude: hotel.lat || undefined,
            longitude: hotel.long || undefined,
            instantConfirm: hotelData.extras?.instant_confirm || false,
            isHot: hotelData.extras?.cheap || false,
            pricePerNight: hotelData.price_per_night || Math.round(hotelPrice / Math.max(1, nights)),
            availability: hotelData.availability?.hotel || 'available',
            matchScore: calculateMatchScore(hotel, hotelData, params)
          };
          
          // Применяем фильтры
          // Фильтр по минимальной звездности
          if (params.minStarRating && tour.hotelStars < params.minStarRating) {
            continue;
          }
          
          // Фильтр по типу питания
          if (params.mealType && params.mealType !== 'any') {
            const tourMealType = tour.mealType?.toLowerCase() || '';
            const requiredMealType = params.mealType.toLowerCase();
            
            // Проверяем соответствие типа питания
            const mealTypeMatch = 
              (requiredMealType === 'all_inclusive' && (tourMealType.includes('всё включено') || tourMealType.includes('all'))) ||
              (requiredMealType === 'breakfast' && (tourMealType.includes('завтрак') || tourMealType.includes('bb'))) ||
              (requiredMealType === 'half_board' && (tourMealType.includes('полупансион') || tourMealType.includes('hb'))) ||
              (requiredMealType === 'full_board' && (tourMealType.includes('полный пансион') || tourMealType.includes('fb')));
              
            if (!mealTypeMatch) {
              continue;
            }
          }
          
          result.push(tour);
        }
      } catch (e) {
        logger.warn('Level.Travel: error processing hotel entry');
        continue;
      }
    }

    logger.info(`Level.Travel: collected ${result.length} tours`);
    
    // Обогащаем топ-5 результатов детальной информацией об отелях
    if (result.length > 0) {
      logger.info('Enriching top hotels with detailed information...');
      const topResults = result.slice(0, 5);
      
      const enrichmentPromises = topResults.map(async (tour) => {
        try {
          // Извлекаем ID отеля из externalId (формат: "lt-123456")
          const hotelId = tour.externalId.replace('lt-', '');
          const hotelDetails = await fetchHotelDetails(hotelId);
          
          if (hotelDetails) {
            // Обогащаем данные тура детальной информацией
            if (hotelDetails.mealTypes && hotelDetails.mealTypes.length > 0) {
              tour.mealType = parseMealType(hotelDetails.mealTypes[0]);
            }
            
            if (hotelDetails.beach_distance !== undefined && hotelDetails.beach_distance !== null) {
              tour.beachDistance = hotelDetails.beach_distance;
            }
            
            if (hotelDetails.beach_type) {
              tour.beachType = hotelDetails.beach_type;
            }
            
            if (hotelDetails.airport_distance !== undefined && hotelDetails.airport_distance !== null) {
              tour.airportDistance = hotelDetails.airport_distance;
            }
            
            if (hotelDetails.photos && hotelDetails.photos.length > 0) {
              // Обновляем изображения более качественными
              tour.images = hotelDetails.photos.map((photo: any) => photo.url || photo).filter(Boolean);
              if (tour.images.length > 0) {
                tour.image = tour.images[0];
              }
            }
            
            if (hotelDetails.description && hotelDetails.description.length > tour.description.length) {
              tour.description = hotelDetails.description;
            }
            
            logger.debug(`Enriched hotel ${tour.hotel} with detailed information`);
          }
        } catch (error) {
          logger.warn(`Failed to enrich hotel ${tour.hotel}:`, error);
        }
      });
      
      await Promise.all(enrichmentPromises);
      logger.info('Hotel enrichment completed');
    }
    
    return result;
  } catch (error) {
    const errorMessage = (error as Error).message || 'Неизвестная ошибка';
    logger.error('Level.Travel API error', { message: errorMessage });
    const err = new Error(`Error fetching tours from Level.Travel: ${errorMessage}`) as ProviderError;
    err.provider = 'Level.Travel';
    throw err;
  }
}

/**
 * Генерация партнерской ссылки
 */
function generateAffiliateLink(
  hotel: any, 
  variant: any, 
  params: TourSearchParams
): string {
  const baseUrl = process.env.LEVEL_TRAVEL_AFFILIATE_URL || 'https://level.travel';
  const marker = process.env.LEVEL_TRAVEL_MARKER || '627387';
  
  // Формируем параметры для ссылки
  const urlParams = new URLSearchParams({
    marker: marker,
    hotel_id: hotel.id.toString(),
    tour_id: variant.tour_id || '',
    start_date: params.startDate?.toISOString().split('T')[0] || '',
    nights: (params.tripDuration || params.nights || 7).toString(),
    adults: (params.adults || 2).toString(),
    kids: (params.children || 0).toString()
  });
  
  // Если есть возраст детей
  if (params.childrenAges && params.childrenAges.length > 0) {
    urlParams.append('kids_ages', params.childrenAges.join(','));
  }
  
  // Используем базовый URL из партнерской ссылки
  if (baseUrl.includes('level.tpx.lt')) {
    // Это уже партнерская ссылка
    return `${baseUrl}?${urlParams.toString()}`;
  } else {
    // Обычная ссылка Level.Travel
    return `https://level.travel/tours/${hotel.id}?${urlParams.toString()}`;
  }
}

/**
 * Расчет оценки соответствия
 */
function calculateMatchScore(hotel: any, hotelData: any, params: TourSearchParams): number {
  let score = 50;
  if (hotel.rating) score += hotel.rating * 2;
  if (hotel.reviews_count > 10) score += 5;
  if (hotel.reviews_count > 50) score += 5;
  if (hotel.stars >= 4) score += 10;
  if (hotel.stars === 5) score += 10;
  if ((params.children || 0) > 0) {
    if (hotel.features?.kids_club) score += 10;
    if (hotel.features?.kids_pool) score += 5;
    if (hotel.features?.kids_menu) score += 5;
  }
  if (hotel.features?.beach_distance && hotel.features.beach_distance < 500) score += 10;
  if (hotelData.extras?.instant_confirm) score += 5;
  return Math.min(100, score);
}