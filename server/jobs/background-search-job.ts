import { CronJob } from 'cron';
import { checkBackgroundSearches } from '../services/background-search';
import logger from '../utils/logger';

let backgroundSearchJob: CronJob | null = null;

/**
 * Запускает cron job для проверки фоновых поисков
 */
export function startBackgroundSearchJob() {
  // Проверяем, включена ли функция
  if (process.env.ENABLE_BACKGROUND_SEARCH !== 'true') {
    logger.info('Background search is disabled');
    return;
  }

  // Определяем расписание из переменной окружения или используем дефолтное
  const schedule = process.env.BACKGROUND_SEARCH_SCHEDULE || '0 9,21 * * *'; // По умолчанию в 9:00 и 21:00

  backgroundSearchJob = new CronJob(
    schedule,
    async () => {
      logger.info('Starting scheduled background search check...');
      const startTime = Date.now();
      
      try {
        await checkBackgroundSearches();
        
        const duration = Date.now() - startTime;
        logger.info(`Background search check completed in ${duration}ms`);
      } catch (error) {
        logger.error('Error in background search job:', error);
      }
    },
    null, // onComplete
    true, // start immediately
    'Europe/Moscow' // timezone
  );

  logger.info(`Background search job started with schedule: ${schedule}`);
}

/**
 * Останавливает cron job
 */
export function stopBackgroundSearchJob() {
  if (backgroundSearchJob) {
    backgroundSearchJob.stop();
    backgroundSearchJob = null;
    logger.info('Background search job stopped');
  }
}

/**
 * Выполняет немедленную проверку (для тестирования)
 */
export async function runBackgroundSearchNow() {
  logger.info('Running background search check immediately...');
  const startTime = Date.now();
  
  try {
    await checkBackgroundSearches();
    
    const duration = Date.now() - startTime;
    logger.info(`Immediate background search check completed in ${duration}ms`);
    return { success: true, duration };
  } catch (error) {
    logger.error('Error in immediate background search:', error);
    return { success: false, error: (error as Error).message };
  }
}