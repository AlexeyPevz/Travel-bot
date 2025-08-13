import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as path from 'path';
import { fileURLToPath } from 'url';
import logger from '../server/utils/logger';

async function runMigrations() {
  logger.info('Starting database migrations...');
  
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    // Resolve migrations folder relative to the repo path (works in dist and src)
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    // Prefer dist-copied migrations; fallback to source path
    const distMigrations = path.join(currentDir, 'migrations');
    const srcMigrations = path.resolve(currentDir, '../../db/migrations');
    const migrationsFolder = distMigrations;

    await migrate(db, { migrationsFolder });

    logger.info('Migrations completed successfully');
  } catch (error) {
    logger.error('Migration failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run migrations if executed directly
const isDirectRun = (() => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return invoked && path.resolve(thisFile) === invoked;
  } catch {
    return false;
  }
})();

if (isDirectRun) {
  runMigrations()
    .then(() => {
      logger.info('Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Migration script failed:', error);
      process.exit(1);
    });
}

export { runMigrations };