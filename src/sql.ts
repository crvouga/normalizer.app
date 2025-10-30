import { SQL } from 'bun';
import type { Logger } from './lib/logger';
import { SQL_SCHEMA } from './sql-schema';

// Global connection instance to prevent multiple connections during hot reload
let globalSQL: SQL | null = null;
let isInitialized = false;

export const createSQL = async ({ logger }: { logger: Logger }): Promise<SQL> => {
  // Return existing connection if available and healthy
  if (globalSQL && isInitialized) {
    try {
      await globalSQL`SELECT 1`;
      logger.info('Reusing existing database connection');
      return globalSQL;
    } catch (error) {
      logger.warn('Existing connection is unhealthy, creating new one', {
        error,
      });
      globalSQL = null;
      isInitialized = false;
    }
  }

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

  logger.info('Creating new database connection...');
  const sql = new SQL(databaseUrl);

  logger.info('Checking database health...');
  try {
    await sql`SELECT 1`;
    logger.info('Database connection successful');
  } catch (error) {
    logger.error('Database connection failed:', error);
    throw new Error('Failed to connect to database');
  }

  // Only apply schema if not already initialized
  if (!isInitialized) {
    await applySqlSchema({ sql, logger });
    isInitialized = true;
  }

  globalSQL = sql;
  return sql;
};

const applySqlSchema = async ({ sql, logger }: { sql: SQL; logger: Logger }): Promise<void> => {
  logger.info('Applying database schema...');
  try {
    await sql.unsafe(SQL_SCHEMA);
    logger.info('Successfully applied database schema');
  } catch (error) {
    logger.error('Failed to apply database schema', { error });
    throw error;
  }
};

// Cleanup function to close connections gracefully
export const cleanupSQL = async (logger: Logger): Promise<void> => {
  if (globalSQL) {
    try {
      logger.info('Closing database connection...');
      // Note: Bun's SQL doesn't have an explicit close method, but we can clear the reference
      globalSQL = null;
      isInitialized = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }
  }
};
