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

    // Create a temporary SQL connection for migrations
    const sql = new SQL(databaseUrl);
    const db = drizzle(sql);

    // Run migrations from the migrations folder
    await migrate(db, { migrationsFolder: './migrations' });

    logger.info('Database migrations complete.');
  } catch (err) {
    logger.error('Failed to run database migrations:', err);
    throw err;
  }
}
