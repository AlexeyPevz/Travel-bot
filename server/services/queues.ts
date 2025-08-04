import Bull, { Queue, Job } from 'bull';
import Redis from 'ioredis';
import logger from '../utils/logger';
import { monitorProfileTours, monitorGroupTours, checkDeadline } from './monitoring';
import { analyzeTourRequest } from './openrouter';
import { searchTours } from '../providers';
import { sendTourNotification } from '../bot/notifications';

// Redis конфигурация для Bull
const redisConfig = {
  port: parseInt(process.env.REDIS_PORT || '6379'),
  host: process.env.REDIS_HOST || 'localhost',
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0')
};

// Создаем очереди
export const tourMonitoringQueue = new Bull('tour-monitoring', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

export const aiAnalysisQueue = new Bull('ai-analysis', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 50,
    removeOnFail: 25,
    attempts: 2,
    timeout: 30000 // 30 секунд
  }
});

export const notificationQueue = new Bull('notifications', {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 200,
    removeOnFail: 100,
    attempts: 5,
    backoff: {
      type: 'fixed',
      delay: 5000
    }
  }
});

// Интерфейсы для типов задач
interface MonitoringJobData {
  userId: string;
  profileId: number;
  taskType: 'profile_monitor' | 'group_monitor' | 'deadline_check';
  groupId?: number;
}

interface AIAnalysisJobData {
  message: string;
  userId?: string;
}

interface NotificationJobData {
  type: 'tour_found' | 'deadline_reached' | 'group_vote';
  userId: string;
  data: any;
}

// Обработчики очередей
tourMonitoringQueue.process(async (job: Job<MonitoringJobData>) => {
  const { userId, profileId, taskType, groupId } = job.data;
  
  logger.info(`Processing monitoring job ${job.id} for user ${userId}`);
  
  try {
    switch (taskType) {
      case 'profile_monitor':
        await monitorProfileTours(userId, profileId);
        break;
        
      case 'group_monitor':
        if (groupId) {
          await monitorGroupTours(groupId);
        }
        break;
        
      case 'deadline_check':
        await checkDeadline(userId, profileId);
        break;
        
      default:
        throw new Error(`Unknown task type: ${taskType}`);
    }
    
    logger.info(`Completed monitoring job ${job.id}`);
  } catch (error) {
    logger.error(`Failed monitoring job ${job.id}:`, error);
    throw error;
  }
});

aiAnalysisQueue.process(async (job: Job<AIAnalysisJobData>) => {
  const { message, userId } = job.data;
  
  logger.info(`Processing AI analysis job ${job.id}`);
  
  try {
    const result = await analyzeTourRequest(message);
    
    logger.info(`Completed AI analysis job ${job.id}`);
    return result;
  } catch (error) {
    logger.error(`Failed AI analysis job ${job.id}:`, error);
    throw error;
  }
});

notificationQueue.process(async (job: Job<NotificationJobData>) => {
  const { type, userId, data } = job.data;
  
  logger.info(`Processing notification job ${job.id} for user ${userId}`);
  
  try {
    switch (type) {
      case 'tour_found':
        await sendTourNotification(userId, data.tours);
        break;
        
      case 'deadline_reached':
        // Отправка уведомления о дедлайне
        break;
        
      case 'group_vote':
        // Отправка уведомления о голосовании
        break;
        
      default:
        throw new Error(`Unknown notification type: ${type}`);
    }
    
    logger.info(`Completed notification job ${job.id}`);
  } catch (error) {
    logger.error(`Failed notification job ${job.id}:`, error);
    throw error;
  }
});

// Обработчики событий очередей
tourMonitoringQueue.on('completed', (job, result) => {
  logger.debug(`Monitoring job ${job.id} completed`);
});

tourMonitoringQueue.on('failed', (job, err) => {
  logger.error(`Monitoring job ${job.id} failed:`, err);
});

aiAnalysisQueue.on('completed', (job, result) => {
  logger.debug(`AI analysis job ${job.id} completed`);
});

aiAnalysisQueue.on('failed', (job, err) => {
  logger.error(`AI analysis job ${job.id} failed:`, err);
});

notificationQueue.on('completed', (job, result) => {
  logger.debug(`Notification job ${job.id} completed`);
});

notificationQueue.on('failed', (job, err) => {
  logger.error(`Notification job ${job.id} failed:`, err);
});

// Функции для добавления задач в очереди
export async function scheduleMonitoring(
  userId: string,
  profileId: number,
  taskType: MonitoringJobData['taskType'],
  delay?: number,
  groupId?: number
) {
  const jobData: MonitoringJobData = {
    userId,
    profileId,
    taskType,
    groupId
  };
  
  const options: any = {
    delay,
    jobId: `${taskType}-${userId}-${profileId}`
  };
  
  if (taskType === 'profile_monitor' || taskType === 'group_monitor') {
    // Повторяющиеся задачи каждые 30 минут
    options.repeat = {
      every: 30 * 60 * 1000 // 30 минут
    };
  }
  
  const job = await tourMonitoringQueue.add(jobData, options);
  logger.info(`Scheduled monitoring job ${job.id} for user ${userId}`);
  
  return job;
}

export async function scheduleAIAnalysis(message: string, userId?: string) {
  const job = await aiAnalysisQueue.add({ message, userId });
  logger.info(`Scheduled AI analysis job ${job.id}`);
  
  return job;
}

export async function scheduleNotification(
  type: NotificationJobData['type'],
  userId: string,
  data: any,
  delay?: number
) {
  const job = await notificationQueue.add(
    { type, userId, data },
    { delay }
  );
  
  logger.info(`Scheduled notification job ${job.id} for user ${userId}`);
  
  return job;
}

// Функция для остановки мониторинга пользователя
export async function stopUserMonitoring(userId: string) {
  const jobs = await tourMonitoringQueue.getRepeatableJobs();
  
  for (const job of jobs) {
    if (job.id?.includes(userId)) {
      await tourMonitoringQueue.removeRepeatableByKey(job.key);
      logger.info(`Stopped monitoring for user ${userId}`);
    }
  }
}

// Функция для получения статистики очередей
export async function getQueueStats() {
  const [
    monitoringStats,
    aiStats,
    notificationStats
  ] = await Promise.all([
    tourMonitoringQueue.getJobCounts(),
    aiAnalysisQueue.getJobCounts(),
    notificationQueue.getJobCounts()
  ]);
  
  return {
    monitoring: monitoringStats,
    aiAnalysis: aiStats,
    notifications: notificationStats
  };
}

// Функция для очистки старых выполненных задач
export async function cleanupQueues() {
  try {
    const cleanupTime = 24 * 60 * 60 * 1000; // 24 часа
    
    await Promise.all([
      tourMonitoringQueue.clean(cleanupTime, 'completed'),
      tourMonitoringQueue.clean(cleanupTime, 'failed'),
      aiAnalysisQueue.clean(cleanupTime, 'completed'),
      aiAnalysisQueue.clean(cleanupTime, 'failed'),
      notificationQueue.clean(cleanupTime, 'completed'),
      notificationQueue.clean(cleanupTime, 'failed')
    ]);
    
    logger.info('Queue cleanup completed');
  } catch (error) {
    logger.error('Queue cleanup error:', error);
  }
}

// Запускаем очистку каждые 12 часов
setInterval(cleanupQueues, 12 * 60 * 60 * 1000);

// Экспортируем для использования в других модулях
export default {
  tourMonitoringQueue,
  aiAnalysisQueue,
  notificationQueue,
  scheduleMonitoring,
  scheduleAIAnalysis,
  scheduleNotification,
  stopUserMonitoring,
  getQueueStats
};