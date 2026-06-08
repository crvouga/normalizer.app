import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Logger } from '../lib/logger';
import {
  assertSafeDatabaseUrl,
  isTestEnvironment,
} from '../test/assert-safe-database-url';
import { DB_SCHEMA_NAME } from './db-schema';

/**
 * Runs drizzle migrations using postgres npm package
 * Provides verbose logging for debugging and traceability
 */
export async function runMigrations(logger: Logger): Promise<void> {
  try {
    logger.info('🔧 Starting database migration process...');

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      logger.error('❌ DATABASE_URL environment variable is not set');
      throw new Error('DATABASE_URL environment variable is not set');
    }

    if (isTestEnvironment()) {
      assertSafeDatabaseUrl(databaseUrl);
    }

    logger.debug('Parsing DATABASE_URL...');
    const url = new URL(databaseUrl);

    logger.debug('Database connection details:', {
      protocol: url.protocol,
      username: url.username,
      host: url.hostname,
      port: url.port,
      database: url.pathname.replace(/^\//, ''),
      schema: DB_SCHEMA_NAME,
      query: url.search,
    });

    const isLocalhost =
      url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1';

    if (!isLocalhost && !url.searchParams.has('sslmode') && !url.searchParams.has('ssl')) {
      logger.info(
        'SSL mode not detected in connection string for non-localhost; adding sslmode=require',
      );
      url.searchParams.set('sslmode', 'require');
    }

    logger.info('Connecting to the database...');
    const sql = postgres(url.toString(), {
      onnotice: () => {},
      connection: {
        search_path: DB_SCHEMA_NAME,
      },
    });

    await sql.unsafe(`SET search_path TO "${DB_SCHEMA_NAME}"`);

    logger.debug('Instantiating drizzle ORM...');
    const db = drizzle(sql);

    logger.info(`Running schema migrations from "./migrations" into schema "${DB_SCHEMA_NAME}"...`);
    await migrate(db, {
      migrationsFolder: './migrations',
      migrationsSchema: DB_SCHEMA_NAME,
    });
    logger.info('✅ Database migrations complete.');

    await sql.end();
  } catch (err) {
    logger.error('❌ Failed to run database migrations:', { error: err });
    throw err;
  }
}
