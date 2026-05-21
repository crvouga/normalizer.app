import postgres from 'postgres';
import type { Logger } from '../lib/logger';

/**
 * Creates a postgres connection with proper configuration.
 * Handles SSL setup for production databases and validates the connection.
 *
 * @param logger - Logger instance for logging connection details
 * @returns A configured postgres connection instance
 */
export const createPostgresConnection = async ({
  logger,
}: {
  logger: Logger;
}): Promise<ReturnType<typeof postgres>> => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logger.error('DATABASE_URL environment variable is not set');
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Log non-sensitive database config
  const dbUrlObj = new URL(databaseUrl);
  logger.info('Database configuration:', {
    host: dbUrlObj.hostname,
    port: dbUrlObj.port,
    database: dbUrlObj.pathname.slice(1),
    user: dbUrlObj.username,
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
  // Connection hardening, primarily for surviving Fly machine suspend/resume
  // cycles where loopback TCP sockets between this app and the in-container
  // Postgres can be left in a half-dead state. With these timeouts, stale
  // pool connections are reaped quickly and replaced rather than hanging
  // queries for minutes waiting on TCP keepalive.
  const sql = postgres(dbUrlObj.toString(), {
    connect_timeout: 10,
    idle_timeout: 30,
    max_lifetime: 60 * 30,
  });

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
