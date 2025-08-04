import { Server } from 'http';
import logger from './logger';
import { pool } from '../../db';
import { redis } from '../services/cache';
import { 
  monitoringQueue, 
  aiAnalysisQueue, 
  notificationQueue 
} from '../services/queues';
import TelegramBot from 'node-telegram-bot-api';

interface ShutdownHandler {
  name: string;
  handler: () => Promise<void>;
  timeout?: number;
}

class GracefulShutdown {
  private shutdownHandlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private server?: Server;
  private bot?: TelegramBot;
  private shutdownTimeout = 30000; // 30 seconds default

  constructor() {
    this.setupSignalHandlers();
  }

  /**
   * Register HTTP server for graceful shutdown
   */
  setServer(server: Server) {
    this.server = server;
  }

  /**
   * Register Telegram bot for graceful shutdown
   */
  setBot(bot: TelegramBot) {
    this.bot = bot;
  }

  /**
   * Register a shutdown handler
   */
  registerHandler(handler: ShutdownHandler) {
    this.shutdownHandlers.push(handler);
  }

  /**
   * Setup signal handlers for graceful shutdown
   */
  private setupSignalHandlers() {
    // Handle termination signals
    ['SIGTERM', 'SIGINT'].forEach(signal => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, starting graceful shutdown...`);
        await this.shutdown();
      });
    });

    // Handle uncaught errors
    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception:', error);
      await this.shutdown(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
      await this.shutdown(1);
    });
  }

  /**
   * Perform graceful shutdown
   */
  async shutdown(exitCode = 0) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    logger.info('Starting graceful shutdown...');

    // Set a timeout for shutdown
    const forceExitTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit');
      process.exit(exitCode);
    }, this.shutdownTimeout);

    try {
      // Step 1: Stop accepting new connections
      if (this.server) {
        await this.closeServer();
      }

      // Step 2: Stop bot from accepting new messages
      if (this.bot) {
        await this.stopBot();
      }

      // Step 3: Close all queues gracefully
      await this.closeQueues();

      // Step 4: Execute custom shutdown handlers
      await this.executeHandlers();

      // Step 5: Close database connections
      await this.closeDatabase();

      // Step 6: Close Redis connection
      await this.closeRedis();

      clearTimeout(forceExitTimeout);
      logger.info('Graceful shutdown completed');
      process.exit(exitCode);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      clearTimeout(forceExitTimeout);
      process.exit(1);
    }
  }

  /**
   * Close HTTP server
   */
  private closeServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      logger.info('Closing HTTP server...');
      
      // Stop accepting new connections
      this.server.close((err) => {
        if (err) {
          logger.error('Error closing server:', err);
          reject(err);
        } else {
          logger.info('HTTP server closed');
          resolve();
        }
      });

      // Force close connections after timeout
      setTimeout(() => {
        logger.warn('Forcing server connections to close');
        resolve();
      }, 10000);
    });
  }

  /**
   * Stop Telegram bot
   */
  private async stopBot(): Promise<void> {
    if (!this.bot) return;

    logger.info('Stopping Telegram bot...');
    try {
      await this.bot.stopPolling();
      await this.bot.close();
      logger.info('Telegram bot stopped');
    } catch (error) {
      logger.error('Error stopping bot:', error);
    }
  }

  /**
   * Close all job queues
   */
  private async closeQueues(): Promise<void> {
    logger.info('Closing job queues...');
    
    const queues = [monitoringQueue, aiAnalysisQueue, notificationQueue];
    
    try {
      // Pause all queues first
      await Promise.all(queues.map(queue => queue.pause(true)));
      logger.info('All queues paused');

      // Wait for active jobs to complete (with timeout)
      const jobTimeout = 15000; // 15 seconds
      const waitPromises = queues.map(queue => 
        new Promise<void>((resolve) => {
          const checkInterval = setInterval(async () => {
            const activeCount = await queue.getActiveCount();
            if (activeCount === 0) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 1000);

          // Timeout after jobTimeout
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, jobTimeout);
        })
      );

      await Promise.all(waitPromises);
      logger.info('Active jobs completed or timed out');

      // Close all queues
      await Promise.all(queues.map(queue => queue.close()));
      logger.info('All queues closed');
    } catch (error) {
      logger.error('Error closing queues:', error);
    }
  }

  /**
   * Execute custom shutdown handlers
   */
  private async executeHandlers(): Promise<void> {
    for (const handler of this.shutdownHandlers) {
      try {
        logger.info(`Executing shutdown handler: ${handler.name}`);
        
        const timeout = handler.timeout || 5000;
        await Promise.race([
          handler.handler(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Handler timeout')), timeout)
          ),
        ]);
        
        logger.info(`Shutdown handler completed: ${handler.name}`);
      } catch (error) {
        logger.error(`Error in shutdown handler ${handler.name}:`, error);
      }
    }
  }

  /**
   * Close database connections
   */
  private async closeDatabase(): Promise<void> {
    logger.info('Closing database connections...');
    try {
      await pool.end();
      logger.info('Database connections closed');
    } catch (error) {
      logger.error('Error closing database:', error);
    }
  }

  /**
   * Close Redis connection
   */
  private async closeRedis(): Promise<void> {
    logger.info('Closing Redis connection...');
    try {
      await redis.quit();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error closing Redis:', error);
    }
  }
}

// Export singleton instance
export const gracefulShutdown = new GracefulShutdown();

// Helper function to register shutdown handlers
export function onShutdown(name: string, handler: () => Promise<void>, timeout?: number) {
  gracefulShutdown.registerHandler({ name, handler, timeout });
}