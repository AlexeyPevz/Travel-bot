import winston from 'winston';
import path from 'path';
import fs from 'fs';

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

// Ensure logs directory exists
const logsDir = path.join(process.cwd(), 'logs');
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
} catch (e) {
  // If we cannot create logs directory, we'll fallback to console-only
  // and proceed without throwing to avoid crashing the app at startup
}

// Define base log format (no color, used for files)
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.printf(
    (info) => {
      const { timestamp, level, message, correlationId, ...rest } = info;
      let log = `${timestamp} ${level}: `;
      if (correlationId) {
        log += `[${correlationId}] `;
      }
      log += message;
      if (Object.keys(rest).length > 0) {
        log += ` ${JSON.stringify(rest)}`;
      }
      return log;
    }
  ),
);

// Define transports
const transports: winston.transport[] = [
  // Console transport with colorized output
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize({ all: true }),
      baseFormat
    )
  }),
];

// Attempt to add file transports safely
try {
  const errorFile = new winston.transports.File({
    filename: path.join(logsDir, 'error.log'),
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: baseFormat,
  });
  errorFile.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Logger error transport failed:', err);
  });
  transports.push(errorFile);

  const combinedFile = new winston.transports.File({
    filename: path.join(logsDir, 'combined.log'),
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: baseFormat,
  });
  combinedFile.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Logger combined transport failed:', err);
  });
  transports.push(combinedFile);
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('Failed to initialize file transports, continuing with console only:', e);
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  levels,
  format: baseFormat,
  transports,
});

// Handle logger-level transport errors to avoid unhandled exceptions
logger.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error('Winston logger emitted an error:', err);
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

// Handle exceptions and rejections (safely)
try {
  const exceptionsTransport = new winston.transports.File({ filename: path.join(logsDir, 'exceptions.log') });
  exceptionsTransport.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Logger exceptions transport failed:', err);
  });
  logger.exceptions.handle(exceptionsTransport);
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('Failed to initialize exceptions transport:', e);
}

try {
  const rejectionsTransport = new winston.transports.File({ filename: path.join(logsDir, 'rejections.log') });
  rejectionsTransport.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('Logger rejections transport failed:', err);
  });
  logger.rejections.handle(rejectionsTransport);
} catch (e) {
  // eslint-disable-next-line no-console
  console.error('Failed to initialize rejections transport:', e);
}

export default logger;