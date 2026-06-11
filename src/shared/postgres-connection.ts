import postgres from 'postgres';
import type { Logger } from '../lib/logger';
import { DB_SCHEMA_NAME } from '../db/db-schema';
import { ensureSchemaExists } from '../db/ensure-schema';
import { assertSafeDatabaseUrl, isTestEnvironment } from '../test/assert-safe-database-url';

/**
 * Creates a postgres connection with proper configuration.
 * Handles SSL setup for production databases and validates the connection.
 * All queries are scoped to the app schema via search_path (public excluded).
 *
 * @param logger - Logger instance for logging connection details
 * @param schemaName - Postgres schema to scope all queries to
 * @returns A configured postgres connection instance
 */
export const createPostgresConnection = async ({
  logger,
  schemaName = DB_SCHEMA_NAME,
}: {
  logger: Logger;
  schemaName?: string;
}): Promise<ReturnType<typeof postgres>> => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logger.error('DATABASE_URL environment variable is not set');
    throw new Error('DATABASE_URL environment variable is not set');
  }

  if (isTestEnvironment()) {
    assertSafeDatabaseUrl(databaseUrl);
  }

  // Log non-sensitive database config
  const dbUrlObj = new URL(databaseUrl);
  logger.info('Database configuration:', {
    host: dbUrlObj.hostname,
    port: dbUrlObj.port,
    database: dbUrlObj.pathname.slice(1),
    user: dbUrlObj.username,
    schema: schemaName,
    // Omit password for security
  });

  // Ensure SSL is enabled for production databases (non-localhost)
  const isLocalhost =
    dbUrlObj.hostname === 'localhost' ||
    dbUrlObj.hostname === '127.0.0.1' ||
    dbUrlObj.hostname === '::1';

  if (!isLocalhost && !dbUrlObj.searchParams.has('sslmode') && !dbUrlObj.searchParams.has('ssl')) {
    dbUrlObj.searchParams.set('sslmode', 'require');
    logger.info('Added SSL mode to database connection');
  }

  logger.info('Creating new database connection...');
  const sql = postgres(dbUrlObj.toString(), {
    connect_timeout: 15,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
    max: 5,
    onnotice: () => {},
    connection: {
      search_path: schemaName,
    },
  });

  await ensureSchemaExists(sql, schemaName);
  await sql.unsafe(`SET search_path TO "${schemaName}"`);

  const searchPathRows = await sql<{ search_path: string }[]>`
    SELECT current_setting('search_path') AS search_path
  `;
  const searchPath = searchPathRows[0]?.search_path ?? '';

  const activeSchemas = searchPath.split(',').map((s: string) => s.trim().replace(/^"|"$/g, ''));

  if (!activeSchemas.includes(schemaName)) {
    throw new Error(
      `Database search_path misconfigured: expected schema "${schemaName}" in search_path, got "${searchPath}"`,
    );
  }

  if (activeSchemas.includes('public')) {
    throw new Error('Database search_path must not include public schema in a shared database');
  }

  logger.info('Checking database health...');
  try {
    await sql`SELECT 1`;
    logger.info('Database connection successful');
  } catch (error) {
    logger.error('Database connection failed:', error as Record<string, unknown>);
    throw new Error('Failed to connect to database');
  }

  return sql;
};
