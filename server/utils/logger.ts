import winston from 'winston';
import path from 'path';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston about colors
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => {
      const { timestamp, level, message, correlationId, ...rest } = info;
      let log = `${timestamp} ${level}: `;
      
      // Add correlation ID if present
      if (correlationId) {
        log += `[${correlationId}] `;
      }
      
      log += message;
      
      // Add additional fields if present
      if (Object.keys(rest).length > 0) {
        log += ` ${JSON.stringify(rest)}`;
      }
      
      return log;
    }
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console(),
  
  // File transport for errors
  new winston.transports.File({
    filename: path.join('logs', 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: path.join('logs', 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format,
  transports,
});

// Add stream for Morgan
export const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Specific loggers for different services
export const botLogger = logger.child({ service: 'telegram-bot' });
export const apiLogger = logger.child({ service: 'api' });
export const dbLogger = logger.child({ service: 'database' });
export const aiLogger = logger.child({ service: 'ai' });

// Handle exceptions and rejections
logger.exceptions.handle(
  new winston.transports.File({ filename: path.join('logs', 'exceptions.log') })
);

logger.rejections.handle(
  new winston.transports.File({ filename: path.join('logs', 'rejections.log') })
);

// Extend logger with child method if not present
if (!logger.child) {
  logger.child = function(meta: any) {
    const childLogger = Object.create(this);
    childLogger.defaultMeta = { ...this.defaultMeta, ...meta };
    return childLogger;
  };
}

export default logger;