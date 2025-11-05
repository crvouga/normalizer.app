import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import { migrate } from 'drizzle-orm/bun-sql/migrator';
import type { Logger } from '../lib/logger';

/**
 * Runs drizzle migrations on startup using Bun's SQL driver
 */
export async function runMigrations(logger: Logger): Promise<void> {
  try {
    logger.info('Running database migrations...');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Ensure SSL is enabled for production databases (non-localhost)
    const url = new URL(databaseUrl);
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';
    
    if (!isLocalhost && !url.searchParams.has('sslmode') && !url.searchParams.has('ssl')) {
      url.searchParams.set('sslmode', 'require');
      logger.info('Added SSL mode to database connection');
    }

    // Create a temporary SQL connection for migrations
    const sql = new SQL(url.toString());
    const db = drizzle(sql);

    // Run migrations from the migrations folder
    await migrate(db, { migrationsFolder: './migrations' });

    logger.info('Database migrations complete.');
  } catch (err) {
    logger.error('Failed to run database migrations:', err);
    throw err;
  }
}
