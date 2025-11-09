import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { Logger } from '../lib/logger';

/**
 * Runs drizzle migrations using postgres-js driver (works in all environments)
 */
export async function runMigrations(logger: Logger): Promise<void> {
  let migrationConnection: postgres.Sql | undefined;

  try {
    logger.info('Running database migrations...');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Ensure SSL is enabled for production databases (non-localhost)
    const url = new URL(databaseUrl);
    const isLocalhost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';

    if (!isLocalhost && !url.searchParams.has('sslmode') && !url.searchParams.has('ssl')) {
      url.searchParams.set('sslmode', 'require');
      logger.info('Added SSL mode to database connection');
    }

    // Create a dedicated connection for migrations
    // max: 1 ensures we only use a single connection for migrations
    migrationConnection = postgres(url.toString(), { max: 1 });
    const db = drizzle(migrationConnection);

    logger.info('Migrations folder: ./migrations');

    // Check what migrations have already been applied
    try {
      const appliedMigrations = await migrationConnection`
        SELECT hash, created_at 
        FROM drizzle.__drizzle_migrations 
        ORDER BY created_at ASC
      `;
      logger.info('✅ Currently applied migrations:', {
        count: appliedMigrations.length,
        hashes: appliedMigrations.map((m) => m.hash.substring(0, 8)),
      });

      // Also check if artifacts table exists
      const tables = await migrationConnection`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('files', 'artifacts')
      `;
      logger.info('📊 Relevant tables found:', {
        tables: tables.map((t) => t.tablename),
      });
    } catch (err) {
      logger.info('Could not query existing migrations (table may not exist yet)');
    }

    logger.info('🚀 Starting migration process...');

    // Run migrations from the migrations folder
    const result = await migrate(db, { migrationsFolder: './migrations' });

    logger.info('Migration process complete.', { result });
    logger.info('Database migrations complete.');
  } catch (err) {
    logger.error('Failed to run database migrations:', err);
    throw err;
  } finally {
    // Always close the migration connection
    if (migrationConnection) {
      await migrationConnection.end();
    }
  }
}
