import { Tour } from '@/shared/types';
import logger from '../utils/logger';

/**
 * Заглушка для провайдера Travelata
 * В будущем здесь будет интеграция с API Travelata
 */
export async function fetchToursFromTravelata(params: any): Promise<Tour[]> {
  logger.info('Travelata provider called (stub)', { params });
  
  // Возвращаем пустой массив пока нет реальной интеграции
  return [];
}

export default {
  name: 'Travelata',
  fetchTours: fetchToursFromTravelata,
};