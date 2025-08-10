import crypto from 'crypto';
import logger from './logger';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;
const ITERATIONS = 100000;
const KEY_LENGTH = 32;

// Get encryption key from environment or generate
const MASTER_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

/**
 * Derives an encryption key from the master key and salt
 */
function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(MASTER_KEY, salt, ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts sensitive data
 * @param text Plain text to encrypt
 * @returns Encrypted data with metadata
 */
export function encrypt(text: string): string {
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = deriveKey(salt);
    const iv = crypto.randomBytes(IV_LENGTH);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]);
    
    const tag = cipher.getAuthTag();
    
    // Combine salt, iv, tag, and encrypted data
    const combined = Buffer.concat([salt, iv, tag, encrypted]);
    
    return combined.toString('base64');
  } catch (error) {
    logger.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts sensitive data
 * @param encryptedText Base64 encrypted data
 * @returns Decrypted plain text
 */
export function decrypt(encryptedText: string): string {
  try {
    const combined = Buffer.from(encryptedText, 'base64');
    
    // Extract components
    const salt = combined.slice(0, SALT_LENGTH);
    const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = combined.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = combined.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    
    const key = deriveKey(salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    logger.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hashes data for comparison (one-way)
 * @param data Data to hash
 * @param salt Optional salt
 * @returns Hashed data
 */
export function hash(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(data, actualSalt, ITERATIONS, 64, 'sha512')
    .toString('hex');
  
  return salt ? hash : `${actualSalt}:${hash}`;
}

/**
 * Verifies hashed data
 * @param data Plain data to verify
 * @param hashedData Hashed data with salt
 * @returns True if data matches
 */
export function verifyHash(data: string, hashedData: string): boolean {
  try {
    const [salt, hash] = hashedData.split(':');
    return hash === hash(data, salt);
  } catch (error) {
    return false;
  }
}

/**
 * Generates a secure random token
 * @param length Token length in bytes
 * @returns Hex string token
 */
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Masks sensitive data for logging
 * @param data Data to mask
 * @param visibleChars Number of visible characters at start and end
 * @returns Masked string
 */
export function maskSensitiveData(data: string, visibleChars: number = 4): string {
  if (!data || data.length <= visibleChars * 2) {
    return '*'.repeat(data?.length || 0);
  }
  
  const start = data.slice(0, visibleChars);
  const end = data.slice(-visibleChars);
  const masked = '*'.repeat(Math.max(data.length - visibleChars * 2, 4));
  
  return `${start}${masked}${end}`;
}

/**
 * Encrypts an object's sensitive fields
 * @param obj Object to encrypt
 * @param fields Fields to encrypt
 * @returns Object with encrypted fields
 */
export function encryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = encrypt(result[field] as string) as T[keyof T];
    }
  }
  
  return result;
}

/**
 * Decrypts an object's sensitive fields
 * @param obj Object to decrypt
 * @param fields Fields to decrypt
 * @returns Object with decrypted fields
 */
export function decryptFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): T {
  const result = { ...obj };
  
  for (const field of fields) {
    if (result[field] && typeof result[field] === 'string') {
      try {
        result[field] = decrypt(result[field] as string) as T[keyof T];
      } catch (error) {
        logger.warn(`Failed to decrypt field ${String(field)}`);
        // Keep encrypted value if decryption fails
      }
    }
  }
  
  return result;
}

/**
 * Validates encryption key strength
 */
export function validateEncryptionKey(): boolean {
  if (!process.env.ENCRYPTION_KEY) {
    logger.warn('Using generated encryption key. Set ENCRYPTION_KEY in production!');
    return false;
  }
  
  const key = process.env.ENCRYPTION_KEY;
  
  if (key.length < 64) {
    logger.error('Encryption key too short. Use at least 32 bytes (64 hex chars)');
    return false;
  }
  
  return true;
}

/**
 * Rotates encryption key (for key rotation)
 * @param oldKey Previous encryption key
 * @param newKey New encryption key
 * @param data Encrypted data to re-encrypt
 * @returns Re-encrypted data with new key
 */
export function rotateEncryptionKey(
  oldKey: string,
  newKey: string,
  data: string
): string {
  // Temporarily set old key
  const currentKey = process.env.ENCRYPTION_KEY;
  process.env.ENCRYPTION_KEY = oldKey;
  
  try {
    // Decrypt with old key
    const decrypted = decrypt(data);
    
    // Set new key
    process.env.ENCRYPTION_KEY = newKey;
    
    // Encrypt with new key
    return encrypt(decrypted);
  } finally {
    // Restore original key
    process.env.ENCRYPTION_KEY = currentKey;
  }
}