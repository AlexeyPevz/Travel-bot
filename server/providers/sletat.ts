import { Tour } from '@/shared/types';
import logger from '../utils/logger';

/**
 * Заглушка для провайдера Sletat
 * В будущем здесь будет интеграция с API Sletat
 */
export async function fetchToursFromSletat(params: any): Promise<Tour[]> {
  logger.info('Sletat provider called (stub)', { params });
  
  // Возвращаем пустой массив пока нет реальной интеграции
  return [];
}

export default {
  name: 'Sletat',
  fetchTours: fetchToursFromSletat,
};