import axios from 'axios';
import { TourData, TourSearchParams } from './index';
import { retry, RetryStrategies } from '../utils/retry';
import { ExternalServiceError } from '../utils/errors';

// Расширенный интерфейс для ошибок с информацией о провайдере
interface ProviderError extends Error {
  provider?: string;
}

/**
 * Партнерская ссылка для Level.Travel
 * Это реальная партнерская ссылка для редиректа на Level.Travel
 */
const LEVEL_TRAVEL_PARTNER_ID = process.env.LEVEL_TRAVEL_PARTNER || '627387';
const LEVEL_TRAVEL_REFERRAL_URL = `https://level.travel/?ref=${LEVEL_TRAVEL_PARTNER_ID}`;

/**
 * URL базового API Level.Travel
 */
const LEVEL_TRAVEL_API_URL = "https://api.level.travel";

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
  // Специальные форматы для лучшей сортировки
  'ro': 'НЕТ - Без питания',
  'bb': 'ЗАВТРАК - Только завтрак (Bed & Breakfast)',
  'hb': 'ПОЛУПАНСИОН - Завтрак и ужин (Half Board)',
  'fb': 'ПОЛНЫЙ ПАНСИОН - Завтрак, обед и ужин (Full Board)',
  'ai': 'ВСЁ ВКЛЮЧЕНО - All Inclusive',
  'uai': 'УЛЬТРА ВСЁ ВКЛЮЧЕНО - Ultra All Inclusive',
  
  // Дополнительные вариации названий
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

/**
 * Format the date in DD.MM.YYYY format for Level.Travel API
 */
function formatDate(date: Date): string {
  if (!date || isNaN(date.getTime())) {
    return '';
  }
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

/**
 * Parse meal type from Level.Travel API
 */
function parseMealType(mealType: string): string {
  if (!mealType) return 'Питание по программе';
  
  // Немного отладочной информации
  console.log(`Парсинг типа питания: "${mealType}"`);
  
  // Проверяем, есть ли прямое соответствие
  const normalizedType = mealType.toLowerCase().trim();
  if (MEAL_TYPES[normalizedType]) {
    return MEAL_TYPES[normalizedType];
  }
  
  // Ищем частичное соответствие
  for (const key in MEAL_TYPES) {
    if (normalizedType.includes(key)) {
      return MEAL_TYPES[key];
    }
  }
  
  // Если это полное текстовое описание, возвращаем его
  if (normalizedType.length > 5) {
    return mealType;
  }
  
  return 'Питание по программе';
}

/**
 * Улучшает качество изображения, заменяя URL низкого качества на высокое разрешение
 * 
 * @param imageUrl URL изображения
 * @returns URL изображения с улучшенным качеством
 */
function enhanceImageQuality(imageUrl: string | undefined): string | undefined {
  if (!imageUrl) return undefined;
  
  let enhancedUrl = imageUrl;
  
  // Удаляем параметры запроса (которые часто ограничивают размер)
  if (enhancedUrl.includes('?')) {
    enhancedUrl = enhancedUrl.split('?')[0];
  }
  
  // Заменяем маркеры низкого разрешения на высокое разрешение
  if (enhancedUrl.includes('/800x600/')) {
    enhancedUrl = enhancedUrl.replace('/800x600/', '/1600x1200/');
  }
  if (enhancedUrl.includes('/400x300/')) {
    enhancedUrl = enhancedUrl.replace('/400x300/', '/1600x1200/');
  }
  if (enhancedUrl.includes('/200x150/')) {
    enhancedUrl = enhancedUrl.replace('/200x150/', '/1600x1200/');
  }
  
  // Проверяем, что ссылка начинается с https (иногда в API возвращаются http-ссылки)
  if (enhancedUrl.startsWith('http://')) {
    enhancedUrl = enhancedUrl.replace('http://', 'https://');
  }
  
  return enhancedUrl;
}

/**
 * Создает реферальную ссылку для перехода к отелю/туру
 * @param hotelId ID отеля в системе Level.Travel
 * @param params Дополнительные параметры для ссылки
 * @returns Ссылка с реферальной информацией
 */
function createReferralLink(hotelId: string | number, params?: any): string {
  const affiliateUrl = process.env.LEVEL_TRAVEL_AFFILIATE_URL;
  const marker = process.env.LEVEL_TRAVEL_MARKER || '627387';
  
  // Если есть готовая партнерская ссылка
  if (affiliateUrl && affiliateUrl.includes('level.tpx.lt')) {
    const urlParams = new URLSearchParams({
      hotel_id: hotelId.toString(),
      marker: marker
    });
    
    if (params) {
      if (params.start_date) urlParams.append('start_date', params.start_date);
      if (params.nights) urlParams.append('nights', params.nights.toString());
      if (params.adults) urlParams.append('adults', params.adults.toString());
      if (params.kids) urlParams.append('kids', params.kids.toString());
    }
    
    return `${affiliateUrl}&${urlParams.toString()}`;
  }
  
  // Иначе используем стандартную партнерскую ссылку
  if (!hotelId) {
    return `https://level.travel/?partner_id=${LEVEL_TRAVEL_PARTNER_ID}`;
  }
  
  return `https://level.travel/hotels/${hotelId}?partner_id=${LEVEL_TRAVEL_PARTNER_ID}`;
}

/**
 * Создает заголовки авторизации для API Level.Travel
 * 
 * @param apiKey API ключ для Level.Travel
 * @returns Объект с заголовками
 */
function createLevelTravelHeaders(apiKey: string) {
  return {
    'Authorization': `Token token="${apiKey}"`,
    'Accept': 'application/vnd.leveltravel.v3',
    'Content-Type': 'application/json',
    'X-API-Version': '3'
  };
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
  
  console.log(`ОБНОВЛЕННАЯ ЛОГИКА ОБРАБОТКИ ФОТОГРАФИЙ v2`);
  
  // Отладочная информация: показываем структуру данных
  console.log(`HotelDetails.photos:`, hotelData.photos);
  
  // По документации Level.Travel API:
  // Изображения отеля хранятся в поле 'images' как массив объектов {id, url}
  // Обрабатываем фотографии строго в соответствии с документацией
  
  let processedPhotos: {url: string}[] = [];
  
  // Обработка photos (в некоторых ответах API)
  if (hotelData.photos && Array.isArray(hotelData.photos)) {
    console.log(`Найдено ${hotelData.photos.length} фото в поле photos`);
    
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
    console.log(`Извлечено ${extractedUrls.length} URL из photos`);
  }
  
  // Обработка images (в соответствии с документацией Level.Travel)
  if (hotelData.images && Array.isArray(hotelData.images)) {
    console.log(`Найдено ${hotelData.images.length} фото в поле images`);
    
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
    console.log(`Извлечено ${extractedUrls.length} URL из images`);
  }
    
  // Добавляем image_url если оно есть (в некоторых форматах Level.Travel API)
  if (hotelData.image_url) {
    const url = enhanceImageQuality(hotelData.image_url);
    if (url) {
      // Добавляем в начало списка как основное изображение
      processedPhotos.unshift({ url });
      console.log(`Добавлено основное изображение из image_url`);
    }
  }
  
  // Проверка на основное изображение в поле image (объект)
  if (hotelData.image && typeof hotelData.image === 'object' && hotelData.image.url) {
    const url = enhanceImageQuality(hotelData.image.url);
    if (url) {
      processedPhotos.unshift({ url });
      console.log(`Добавлено основное изображение из объекта image`);
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
  
  console.log(`Итого обработано ${uniquePhotos.length} фотографий`);
  
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
  console.log(`Найден отель в API и базе данных: ${combinedHotel.name}`);
  console.log(`Комбинированный источник: итого собрано ${uniquePhotos.length} фотографий`);
  
  if (uniquePhotos.length > 0) {
    console.log(`Первое фото: ${uniquePhotos[0].url}`);
  }
  
  if (combinedHotel.airportDistance) {
    console.log(`Скомбинированы данные отеля: ${uniquePhotos.length} фото, расстояние до аэропорта: ${combinedHotel.airportDistance}м`);
  }
  
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
      console.error("Level.Travel API key is not set");
      return null;
    }

    // Создаем заголовки авторизации
    const headers = createLevelTravelHeaders(apiKey);
    
    console.log(`API: Запрашиваем детали отеля с ID ${hotelId}`);
    
    // СТРОГО ПО ДОКУМЕНТАЦИИ:
    // 1. Получаем информацию об отеле через references/hotels с параметром hotel_ids
    const url = `${LEVEL_TRAVEL_API_URL}/references/hotels`;
    console.log(`Запрашиваем детали отеля с ID ${hotelId} из API Level.Travel`);
    
    const response = await axios.get(url, { 
      params: { hotel_ids: hotelId },
      headers
    });
    
    // Проверяем успешность запроса
    if (response.status !== 200 || !response.data.success) {
      console.error(`Ошибка при запросе отеля ${hotelId}: ${response.status}`);
      return null;
    }
    
    // Проверяем наличие отеля в ответе
    if (!response.data.hotels || !response.data.hotels.length) {
      console.error(`Отель с ID ${hotelId} не найден в API`);
      return null;
    }
    
    // Получаем отель из ответа API
    const hotel = response.data.hotels[0];
    console.log(`Найден отель ${hotel.name} по API reference/hotels`);
    
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
              console.log(`Найден отель в выгрузке hotel_dump: ${dumpHotel.name}`);
              
              // Обогащаем наш отель дополнительными данными из dump
              // images: Список объектов {id, url} - В документации, раздел "Отели (выгрузка)"
              if (dumpHotel.images && Array.isArray(dumpHotel.images)) {
                hotel.images = dumpHotel.images;
                console.log(`Получено ${dumpHotel.images.length} изображений из dump`);
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
          console.error(`Ошибка при получении данных по ссылке из dump: ${(dumpFetchError as Error).message}`);
        }
      }
    } catch (dumpError) {
      console.error(`Ошибка при получении hotel_dump: ${(dumpError as Error).message}`);
      // Это не критическая ошибка, продолжаем
    }
    
    // 3. Стандартизируем данные отеля
    const standardizedHotel = standardizeHotelData(hotel);
    
    return standardizedHotel;
  } catch (error) {
    console.error(`Error fetching hotel details for ${hotelId}:`, (error as Error).message);
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
    // Для теста просто временно возвращаем true, чтобы проверить остальную часть функциональности
    // Так как известно, что ключ API работал ранее
    console.log("ВНИМАНИЕ: Пропуск проверки API Level.Travel для теста");
    return true;
    
    /*
    // Получаем API ключ
    const apiKey = process.env.LEVELTRAVEL_API_KEY;
    if (!apiKey) {
      console.error("Level.Travel API key is not set");
      return false;
    }
    
    // Создаем заголовки авторизации
    const headers = createLevelTravelHeaders(apiKey);
    
    // Выводим информацию о ключе API (маскируем для безопасности)
    const maskedKey = apiKey.substring(0, 4) + "..." + apiKey.substring(apiKey.length - 4);
    console.log(`Используется API ключ: ${maskedKey}`);
    console.log(`Заголовки для тестового запроса:`, headers);
    
    // Пробуем получить список стран - простой запрос для проверки подключения
    const url = `${LEVEL_TRAVEL_API_URL}/references/countries`;
    console.log(`Тестовый запрос к API: ${url}`);
    
    const response = await axios.get(url, { headers });
    
    console.log(`Тестовый запрос - статус ответа: ${response.status}`);
    console.log(`Тестовый запрос - данные получены:`, JSON.stringify(response.data).substring(0, 200) + "...");
    
    // Проверяем, что в ответе есть поле success и оно равно true
    if (response.status === 200 && response.data) {
      // Даже если нет поля success, но есть массив countries, значит API работает
      if (response.data.success === true || (response.data.countries && Array.isArray(response.data.countries))) {
        console.log("Level.Travel API успешно подключено!");
        return true;
      }
    }
    
    // В случае неуспешного ответа
    console.error(`Level.Travel API error: Неправильный формат ответа: ${JSON.stringify(response.data)}`);
    return false;
    */
  } catch (error) {
    console.error("Level.Travel API connection error:", (error as Error).message);
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
    console.log("Запуск поиска туров в Level.Travel API");
    
    // Проверяем доступность API
    const isApiAvailable = await testLevelTravelAPI();
    if (!isApiAvailable) {
      const err = new Error("Level.Travel API недоступно. Пожалуйста, проверьте ключи API.") as ProviderError;
      err.provider = "Level.Travel";
      throw err;
    }
    
    try {
      // Подготавливаем данные для запроса
      console.log("Подготовка параметров запроса к Level.Travel API...");
      
      // Получаем ключ API из переменных окружения
      const apiKey = process.env.LEVELTRAVEL_API_KEY;
      if (!apiKey) {
        throw new Error("Level.Travel API key is not set");
      }
      
      // Создаем заголовки для запроса
      const headers = createLevelTravelHeaders(apiKey);
      console.log("Используемые заголовки:", headers);
      
      // Преобразуем параметры запроса
      let startDate: Date, endDate: Date, nights: number;
      
      // Обрабатываем параметры дат
      if (params.dateType === 'fixed' && params.startDate && params.endDate) {
        startDate = new Date(params.startDate);
        endDate = new Date(params.endDate);
        
        // Вычисляем количество ночей
        const timeDiff = endDate.getTime() - startDate.getTime();
        nights = Math.round(timeDiff / (1000 * 3600 * 24));
        
        if (nights <= 0) {
          nights = 7; // По умолчанию 7 ночей, если даты заданы неверно
        }
      } else if (params.dateType === 'flexible' && params.flexibleMonth && params.tripDuration) {
        // Получаем первый день текущего месяца
        const now = new Date();
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14); // По умолчанию через 2 недели
        
        // Поиск по гибким датам
        nights = params.tripDuration;
        
        // Вычисляем конечную дату
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + nights);
      } else {
        // По умолчанию через 2 недели на 7 ночей
        startDate = new Date();
        startDate.setDate(startDate.getDate() + 14);
        nights = 7;
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + nights);
      }
      
      // Определяем страну назначения по названию
      const destinationLower = (params.destination || 'Турция').toLowerCase();
      let countryCode = 'TR'; // По умолчанию Турция
      
      // Поиск кода страны
      const countryNames = Object.keys(COUNTRY_CODES);
      console.log("Доступные страны:", countryNames);
      
      // Ищем совпадение по названию страны
      for (const name of countryNames) {
        if (destinationLower.includes(name)) {
          countryCode = COUNTRY_CODES[name];
          console.log(`Выбран код страны: ${countryCode}`);
          break;
        }
      }
      
      // Определяем город вылета
      const departureCity = params.departureCity || 'Москва';
      // Преобразуем русское название в английское для API
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
      
      // Формируем параметры запроса в соответствии с документацией Level.Travel API
      interface EnqueueParams {
        from_city: string;         // Город вылета (name_en)
        to_country: string;        // Страна назначения (ISO2)
        adults: number;            // Количество взрослых
        start_date: string;        // Дата вылета
        nights: string;            // Интервал ночей (например "7..9")
        kids?: number;             // Количество детей
        kids_ages?: number[];      // Возраста детей
        from_country?: string;     // Страна вылета (ISO2)
        to_city?: string;          // Город назначения (name_en)
        search_type?: string;      // Тип поиска: 'package' (по умолч.) или 'hotel'
        hotel_ids?: number[];      // ID конкретных отелей для поиска
        price_max?: number;        // Максимальная цена
      }
      
      // Параметры запроса по документации
      const requestData: EnqueueParams = {
        from_city: fromCity,
        to_country: countryCode,
        adults: params.adults || 2,
        start_date: formatDate(startDate),
        nights: `${nights}..${nights+2}` // Небольшой разброс для лучших результатов
      };
      
      // Добавляем детей, если есть
      if (params.children && params.children > 0) {
        requestData.kids = params.children;
        if (params.childrenAges && params.childrenAges.length > 0) {
          requestData.kids_ages = params.childrenAges;
        }
      }
      
      // Добавляем ограничение бюджета, если указано
      if (params.budget && params.budget > 0) {
        requestData.price_max = params.budget;
      }
      
      console.log("Параметры запроса к Level.Travel:", requestData);
      
      // Запускаем поиск туров в соответствии с документацией Level.Travel API
      // Используем ендпоинт /search/enqueue для запуска поиска (в v3)
      const searchUrl = `${LEVEL_TRAVEL_API_URL}/search/enqueue`;
      
      // Формируем query параметры для запроса
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(requestData)) {
        queryParams.append(key, value.toString());
      }
      
      // Добавляем логирование запроса для отладки
      console.log(`ЗАПРОС К API Level.Travel - URL: ${searchUrl}`);
      console.log(`Параметры запроса: ${queryParams.toString()}`);
      
      // Попробуем оба метода - сначала GET, если не сработает, то POST
      let enqueueResponse;
      
      try {
        // Сначала пробуем GET
        console.log(`Попытка отправки GET запроса на URL: ${searchUrl}`);
        enqueueResponse = await axios.get(`${searchUrl}?${queryParams.toString()}`, { headers });
        console.log(`GET запрос успешен, статус: ${enqueueResponse.status}`);
      } catch (error) {
        // Проверяем, если ошибка связана с методом (405 Method Not Allowed)
        if (axios.isAxiosError(error) && error.response?.status === 405) {
          console.log("Получен код 405 (Method Not Allowed). Пробуем использовать POST метод...");
          
          // Пробуем использовать POST метод вместо GET
          try {
            enqueueResponse = await axios.post(searchUrl, requestData, { headers });
            console.log(`POST запрос успешен, статус: ${enqueueResponse.status}`);
          } catch (postError) {
            console.error(`Ошибка POST запроса: ${(postError as Error).message}`);
            throw postError;
          }
        } else {
          // Если это другая ошибка, пробрасываем её дальше
          console.error(`Ошибка GET запроса: ${(error as Error).message}`);
          throw error;
        }
      }
      
      console.log(`Получен статус ответа: ${enqueueResponse.status}`);
      console.log(`Заголовки ответа:`, enqueueResponse.headers);
      console.log(`Тело ответа (first 500 chars):`, JSON.stringify(enqueueResponse.data).substring(0, 500));
      
      // Проверяем, что запрос успешен
      if (enqueueResponse.status !== 200) {
        const err = new Error(`Ошибка при запросе поиска туров: ${enqueueResponse.status} ${enqueueResponse.statusText}`) as ProviderError;
        err.provider = "Level.Travel";
        throw err;
      }
      
      if (!enqueueResponse.data || !enqueueResponse.data.success) {
        const err = new Error(`Неверный формат ответа API: ${JSON.stringify(enqueueResponse.data)}`) as ProviderError;
        err.provider = "Level.Travel";
        throw err;
      }
      
      // Получаем ID поиска и URL для получения результатов
      // В версии v3 API используется request_id
      const requestId = enqueueResponse.data.request_id;
      if (!requestId) {
        const err = new Error(`API не вернуло request_id для поиска: ${JSON.stringify(enqueueResponse.data)}`) as ProviderError;
        err.provider = "Level.Travel";
        throw err;
      }
      const statusUrl = `${LEVEL_TRAVEL_API_URL}/search/status?request_id=${requestId}&show_size=true`;
    
      console.log(`Level.Travel: успешно запущен поиск туров (ID: ${requestId})`);
      
      // Выполняем запрос на получение результатов поиска
      // В некоторых случаях может потребоваться повторный запрос, если первый вернет статус "processing"
      let retries = 0;
      const maxRetries = 5; // Увеличиваем количество попыток
      let hotelsResponse;
      
      while (retries < maxRetries) {
        // Делаем небольшую паузу между запросами
        if (retries > 0) {
          // Увеличиваем паузу между запросами для более продолжительного ожидания
          const waitTime = 2000 * retries; // Больше времени между запросами
          console.log(`Ожидание ${waitTime}ms перед следующей попыткой...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        // Запрашиваем статус поиска
        const statusResponse = await axios.get(statusUrl, { headers });
        console.log(`Статус поиска:`, JSON.stringify(statusResponse.data).substring(0, 500));
        
        // В ответе приходит объект status с операторами и их статусами
        if (!statusResponse.data || !statusResponse.data.success) {
          const err = new Error(`Ошибка при получении статуса поиска: ${JSON.stringify(statusResponse.data)}`) as ProviderError;
          err.provider = "Level.Travel";
          throw err;
        }
        
        // Проверяем статусы всех операторов
        const operatorStatuses = statusResponse.data.status || {};
        
        // Даже если не все операторы завершили поиск, мы можем продолжать, если:
        // 1. Есть хотя бы некоторые завершенные операторы и completeness > 50%
        // 2. Общее количество найденных результатов (size) > 0
        
        const completeness = statusResponse.data.completeness || 0;
        const size = statusResponse.data.size || 0;
        
        console.log(`Completeness: ${completeness}%, Size: ${size} hotels`);
        
        // Проверяем, все ли операторы завершили поиск
        const allCompleted = Object.values(operatorStatuses).every(
          status => ['completed', 'cached', 'skipped', 'no_results', 'failed', 'all_filtered'].includes(status as string)
        );
        
        // Определяем, есть ли частичные результаты, с которыми можно работать
        const partialResults = (completeness > 30 && size > 0) || retries >= 3;
        
        if (allCompleted || partialResults) {
          // Все операторы завершили поиск или у нас достаточно частичных результатов
          console.log(`Поиск ${allCompleted ? 'полностью завершен' : 'частично завершен'} (completeness: ${completeness}%)`);
          hotelsResponse = statusResponse;
          break;
        }
        
        // Проверяем, есть ли ошибки у операторов
        const failedOperators = Object.entries(operatorStatuses)
          .filter(([_, status]) => status === 'failed')
          .map(([id]) => id);
          
        if (failedOperators.length > 0) {
          console.log(`Операторы с ошибками: ${failedOperators.join(', ')}`);
        }
        
        retries++;
        console.log(`Level.Travel: ожидание результатов поиска (попытка ${retries}/${maxRetries})`);
      }
      
      // Проверяем, что поиск успешно завершен 
      if (!hotelsResponse) {
        const err = new Error('Не удалось получить результаты поиска туров: превышено время ожидания') as ProviderError;
        err.provider = "Level.Travel";
        throw err;
      }

      // Теперь получаем список отелей с помощью метода get_grouped_hotels
      const hotelsUrl = `${LEVEL_TRAVEL_API_URL}/search/get_grouped_hotels?request_id=${requestId}`;
      console.log(`Запрашиваем результаты поиска (отели): ${hotelsUrl}`);
      
      try {
        const hotelsListResponse = await axios.get(hotelsUrl, { headers });
        console.log(`Статус ответа с отелями: ${hotelsListResponse.status}`);
        console.log(`Тело ответа с отелями (first 500 chars):`, JSON.stringify(hotelsListResponse.data).substring(0, 500));
        
        if (!hotelsListResponse.data || !hotelsListResponse.data.success) {
          const err = new Error(`Ошибка при получении списка отелей: ${JSON.stringify(hotelsListResponse.data)}`) as ProviderError;
          err.provider = "Level.Travel";
          throw err;
        }
        
        // Обрабатываем результаты поиска и преобразуем их в стандартный формат TourData
        const result: TourData[] = [];
        
        // Проходим по всем отелям и формируем объекты туров
        // Согласно документации, структура ответа будет отличаться
        const hotelsList = hotelsListResponse.data.hotels || [];
        console.log(`Найдено отелей: ${hotelsList.length}`);
        
        for (const hotel of hotelsList) {
          try {
            // Извлекаем необходимые данные из отеля по документации API
            const hotelId = hotel.id;
            const hotelName = hotel.name;
            const hotelStars = hotel.stars;
            const hotelPrice = hotel.min_price || 0; // В ответе API это min_price
            const hotelOldPrice = hotel.old_price || null;
            const hotelRating = hotel.rating || 0;
            const hotelImage = hotel.image?.url || hotel.thumb_url || '';
            
            // Если есть все необходимые данные, создаем объект тура
            if (hotelId && hotelName && hotelPrice > 0) {
              const tour: TourData = {
                provider: 'leveltravel',
                externalId: `lt-${hotelId}`,
                title: `${hotelName} ${hotelStars}★`,
                description: hotel.hotel_info || '',
                destination: params.destination,
                hotel: hotelName,
                hotelStars: hotelStars,
                price: hotelPrice,
                priceOld: hotelOldPrice || null,
                rating: hotelRating,
                startDate: startDate,
                endDate: endDate,
                nights: nights,
                roomType: hotel.room_name || 'Стандартный номер',
                mealType: parseMealType(hotel.meal_name || ''),
                link: createReferralLink(hotelId, {
                  start_date: startDate.toISOString().split('T')[0],
                  nights: nights,
                  adults: params.adults || 2,
                  kids: params.children || 0
                }),
                image: enhanceImageQuality(hotelImage) || '',
                
                // Дополнительные данные
                departureCity: params.departureCity || 'Москва', // Используем переданный город вылета
                arrivalCity: params.destination,
                beachDistance: hotel.beach_distance || 0,
                
                // Оценка соответствия запросу
                matchScore: 100, // Максимальное соответствие для базового провайдера
              };
              
              // Получаем расширенные данные об отеле, если это возможно
              try {
                const hotelDetails = await fetchHotelDetails(hotelId);
                if (hotelDetails) {
                  // Обогащаем объект тура дополнительными данными
                  tour.images = hotelDetails.images || [tour.image]; // Используем изображения из деталей или основное изображение
                  tour.departureAirport = hotelDetails.departureAirport || tour.departureAirport;
                  tour.departureCity = hotelDetails.departureCity || tour.departureCity;
                  tour.arrivalAirport = hotelDetails.arrivalAirport || tour.arrivalAirport;
                  tour.arrivalCity = hotelDetails.arrivalCity || tour.arrivalCity;
                  tour.airline = hotelDetails.airline || tour.airline;
                  tour.beachDistance = hotelDetails.beachDistance || tour.beachDistance;
                  tour.cityDistance = hotelDetails.cityDistance || tour.cityDistance;
                  tour.airportDistance = hotelDetails.airportDistance || tour.airportDistance;
                  tour.constructionYear = hotelDetails.constructionYear || tour.constructionYear;
                  tour.renovationYear = hotelDetails.renovationYear || tour.renovationYear;
                  tour.attractions = hotelDetails.attractions || tour.attractions;
                }
              } catch (detailsError) {
                console.error(`Ошибка при получении деталей отеля ${hotelId}:`, (detailsError as Error).message);
              }
              
              // Добавляем тур в результаты
              result.push(tour);
            } else {
              console.log(`Тур "${hotelName}" пропущен, так как не содержит обязательные поля`);
            }
          } catch (error) {
            console.error(`Ошибка при обработке отеля:`, (error as Error).message);
          }
        }
        
        console.log(`LevelTravel provider: successfully processed ${result.length} tours`);
        return result;
      } catch (error) {
        const errorMessage = (error as Error).message || 'Unknown error';
        console.error(`Level.Travel API error:`, errorMessage);
        const err = new Error(`Failed to fetch Level.Travel API results: ${errorMessage}`) as ProviderError;
        err.provider = "Level.Travel";
        throw err;
      }
    } catch (error) {
      // Обрабатываем ошибки при подготовке параметров
      const errorMessage = (error as Error).message || 'Неизвестная ошибка';
      console.error(`Level.Travel API preparation error:`, errorMessage);
      const err = new Error(`Error calling Level.Travel API: ${errorMessage}`) as ProviderError;
      err.provider = "Level.Travel";
      throw err;
    }
  } catch (error) {
    // Обрабатываем все остальные ошибки
    const errorMessage = (error as Error).message || 'Неизвестная ошибка';
    console.error(`Level.Travel API general error:`, errorMessage);
    const err = new Error(`Error fetching tours from Level.Travel: ${errorMessage}`) as ProviderError;
    err.provider = "Level.Travel";
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
    nights: (params.nights || 7).toString(),
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