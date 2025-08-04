import { fetchToursFromTravelata } from './travelata';
import { fetchToursFromSletat } from './sletat';
import { fetchToursFromLevelTravel } from './leveltravel';

// Provider interface
export interface TourProvider {
  name: string;
  fetchTours: (params: TourSearchParams) => Promise<TourData[]>;
}

// Tour search parameters
export interface TourSearchParams {
  destination: string;
  dateType: 'fixed' | 'flexible';
  startDate?: Date;
  endDate?: Date;
  flexibleMonth?: string;
  tripDuration?: number;
  budget?: number;
  priorities?: {
    hotelStars?: number;
    beachLine?: number;
    allInclusive?: number;
    reviews?: number;
    renovation?: number;
    animation?: number;
  };
}

// Tour data interface
export interface TourData {
  id?: number;        // ID из базы данных
  provider: string;
  externalId?: string;
  title: string;
  description?: string;
  destination: string;
  hotel: string;
  hotelStars?: number;
  price: number;
  priceOld?: number;
  rating?: number;
  startDate?: Date;
  endDate?: Date;
  nights: number;
  roomType?: string;
  mealType?: string;
  beachLine?: string;
  link: string;
  image?: string;     // Основное изображение
  
  // Дополнительные изображения
  images?: string[];
  
  // Информация о перелете
  departureAirport?: string;
  departureCity?: string;
  arrivalAirport?: string;
  arrivalCity?: string;
  airline?: string;
  
  // Дополнительная информация об отеле
  hotelFeatures?: Record<string, any>;
  roomFeatures?: Record<string, any>;
  attractions?: string[];
  beachDistance?: number; // В метрах
  cityDistance?: number;  // В метрах
  airportDistance?: number; // В метрах
  constructionYear?: number;
  renovationYear?: number;
  
  metadata?: any;
  matchScore?: number;  // Добавляем поле для сортировки по соответствию
}

// Register all tour providers
export const tourProviders: TourProvider[] = [
  {
    name: 'travelata',
    fetchTours: fetchToursFromTravelata
  },
  {
    name: 'sletat',
    fetchTours: fetchToursFromSletat
  },
  {
    name: 'level.travel',
    fetchTours: fetchToursFromLevelTravel
  }
];

/**
 * Fetch tours from all registered providers
 * @param params Tour search parameters
 * @returns Tours from all providers
 */
export async function fetchToursFromAllProviders(params: TourSearchParams): Promise<TourData[]> {
  try {
    const allProviderPromises = tourProviders.map(provider => {
      return provider.fetchTours(params)
        .catch(error => {
          console.error(`Error fetching tours from ${provider.name}:`, error);
          return [] as TourData[];
        });
    });
    
    const allResults = await Promise.all(allProviderPromises);
    
    // Flatten the results
    const tours = allResults.flat();
    
    // Сохраняем туры в базу данных
    try {
      // Динамический импорт, чтобы избежать циклических зависимостей
      const { dbService } = await import('../services/db');
      
      if (tours.length > 0) {
        console.log(`Сохраняем ${tours.length} туров в базу данных...`);
        
        // Подготовим туры для сохранения, добавляя недостающие поля
        const toursForDb = tours.map((tour, index) => {
          // Готовим поля из схемы
          return {
            provider: tour.provider,
            externalId: tour.externalId?.toString() || `ext-${Date.now()}-${index}`,
            title: tour.title,
            description: tour.description || '',
            destination: tour.destination,
            hotel: tour.hotel,
            hotelStars: tour.hotelStars || null,
            price: tour.price,
            priceOld: tour.priceOld || null,
            rating: tour.rating || null,
            startDate: tour.startDate || null,
            endDate: tour.endDate || null,
            nights: tour.nights,
            roomType: tour.roomType || null,
            mealType: tour.mealType || null,
            beachLine: tour.beachLine || null,
            link: tour.link,
            image: tour.image || null,
            matchScore: 0, // Начальный score
            createdAt: new Date(),
            updatedAt: new Date()
          };
        });
        
        // Сохраняем пакетом
        const savedTours = await dbService.saveTourBatch(toursForDb);
        console.log(`Успешно сохранено ${savedTours.length} туров в базу данных`);
        
        // Возвращаем сохраненные туры с ID из базы данных
        if (savedTours.length > 0) {
          // Обновляем оригинальные объекты туров ID из базы данных
          savedTours.forEach((savedTour, index) => {
            if (index < tours.length) {
              tours[index].id = savedTour.id;
            }
          });
        }
      }
    } catch (dbError) {
      console.error('Ошибка при сохранении туров в базу данных:', dbError);
      // Продолжаем выполнение, даже если сохранение не удалось
    }
    
    return tours;
  } catch (error) {
    console.error('Error fetching tours from providers:', error);
    return [];
  }
}

// Export searchTours as an alias for fetchTours for compatibility
export { fetchTours as searchTours };
