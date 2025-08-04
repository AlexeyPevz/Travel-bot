import fs from 'fs';
import path from 'path';
import logger from './logger';

/**
 * Read secret from file or environment variable
 * Supports Docker secrets pattern where secrets are mounted as files
 */
export function getSecret(envVar: string): string | undefined {
  const fileVar = `${envVar}_FILE`;
  
  // First, check if there's a file reference
  const secretFile = process.env[fileVar];
  if (secretFile) {
    try {
      const secretPath = path.resolve(secretFile);
      const secret = fs.readFileSync(secretPath, 'utf8').trim();
      if (secret) {
        logger.debug(`Loaded secret from file: ${envVar}`);
        return secret;
      }
    } catch (error) {
      logger.error(`Failed to read secret file for ${envVar}:`, error);
    }
  }
  
  // Fall back to environment variable
  const secret = process.env[envVar];
  if (secret) {
    logger.debug(`Loaded secret from environment: ${envVar}`);
    return secret;
  }
  
  return undefined;
}

/**
 * Get required secret or throw error
 */
export function getRequiredSecret(envVar: string): string {
  const secret = getSecret(envVar);
  if (!secret) {
    throw new Error(`Required secret ${envVar} is not set`);
  }
  return secret;
}

/**
 * Load all application secrets
 */
export function loadSecrets() {
  return {
    telegramToken: getRequiredSecret('TELEGRAM_TOKEN'),
    openRouterApiKey: getSecret('OPENROUTER_API_KEY'),
    levelTravelApiKey: getSecret('LEVELTRAVEL_API_KEY'),
    sessionSecret: getSecret('SESSION_SECRET') || generateRandomSecret(),
    cookieSecret: getSecret('COOKIE_SECRET') || generateRandomSecret(),
    csrfSecret: getSecret('CSRF_SECRET') || generateRandomSecret(),
    jwtSecret: getSecret('JWT_SECRET') || generateRandomSecret(),
  };
}

/**
 * Generate a random secret for development
 */
function generateRandomSecret(): string {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Generating random secret in production - this should be set via environment');
  }
  return require('crypto').randomBytes(32).toString('hex');
}

/**
 * Validate that all required secrets are present
 */
export function validateSecrets() {
  const required = [
    'TELEGRAM_TOKEN',
    'DATABASE_URL',
  ];
  
  const recommended = [
    'SESSION_SECRET',
    'COOKIE_SECRET',
    'CSRF_SECRET',
    'OPENROUTER_API_KEY',
    'LEVELTRAVEL_API_KEY',
  ];
  
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // Check required secrets
  for (const secret of required) {
    if (!getSecret(secret)) {
      missing.push(secret);
    }
  }
  
  // Check recommended secrets
  for (const secret of recommended) {
    if (!getSecret(secret)) {
      warnings.push(secret);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required secrets: ${missing.join(', ')}`);
  }
  
  if (warnings.length > 0 && process.env.NODE_ENV === 'production') {
    logger.warn(`Missing recommended secrets: ${warnings.join(', ')}`);
  }
}