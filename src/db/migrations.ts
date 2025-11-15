import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Logger } from '../lib/logger';

/**
 * Runs drizzle migrations using postgres npm package
 * Provides verbose logging for debugging and traceability
 */
export async function runMigrations(logger: Logger): Promise<void> {
  try {
    logger.info('🔧 Starting database migration process...');

    const databaseUrl = process.env.DATABASE_URL;
    logger.info(`DATABASE_URL: ${databaseUrl ?? '[undefined]'}`);
    if (!databaseUrl) {
      logger.error('❌ DATABASE_URL environment variable is not set');
      throw new Error('DATABASE_URL environment variable is not set');
    }

    logger.debug('Parsing DATABASE_URL...');
    const url = new URL(databaseUrl);

    logger.debug('Database connection details:', {
      protocol: url.protocol,
      username: url.username,
      host: url.hostname,
      port: url.port,
      database: url.pathname.replace(/^\//, ''),
      query: url.search,
    });

    const isLocalhost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';

    logger.debug(`Is localhost? ${isLocalhost ? 'yes' : 'no'}`);

    if (!isLocalhost && !url.searchParams.has('sslmode') && !url.searchParams.has('ssl')) {
      logger.info(
        'SSL mode not detected in connection string for non-localhost; adding sslmode=require',
      );
      url.searchParams.set('sslmode', 'require');
      logger.info(`Updated connection string: ${url.toString()}`);
    } else if (!isLocalhost) {
      logger.info('SSL is already configured for database connection');
    } else {
      logger.info('Localhost detected, SSL configuration skipped');
    }

    logger.info('Connecting to the database...');
    const sql = postgres(url.toString());

    logger.debug('Instantiating drizzle ORM...');
    const db = drizzle(sql);

    logger.info('Running schema migrations from "./migrations"...');
    await migrate(db, { migrationsFolder: './migrations' });
    logger.info('✅ Database migrations complete.');

    // Cleanup connection
    await sql.end();
  } catch (err) {
    logger.error('❌ Failed to run database migrations:', { error: err });
    throw err;
  }
}
