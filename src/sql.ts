import { SQL } from 'bun';
import { drizzle } from 'drizzle-orm/bun-sql';
import type { Logger } from './lib/logger';
import * as schema from './db/schema';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

// Global connection instance to prevent multiple connections during hot reload
let globalDb: Db | null = null;
let globalSQL: SQL | null = null;
let isInitialized = false;

export const createDb = async ({ logger }: { logger: Logger }): Promise<Db> => {
  // Return existing connection if available and healthy
  if (globalDb && globalSQL && isInitialized) {
    try {
      await globalSQL`SELECT 1`;
      logger.info('Reusing existing database connection');
      return globalDb;
    } catch (error) {
      logger.warn('Existing connection is unhealthy, creating new one', {
        error,
      });
      globalDb = null;
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

  // Create Drizzle instance
  const db = drizzle(sql, { schema });

  // Only apply schema if not already initialized
  if (!isInitialized) {
    isInitialized = true;
  }

  globalSQL = sql;
  globalDb = db;
  return db;
};

// Cleanup function to close connections gracefully
export const cleanupDb = async (logger: Logger): Promise<void> => {
  if (globalSQL || globalDb) {
    try {
      logger.info('Closing database connection...');
      // Note: Bun's SQL doesn't have an explicit close method, but we can clear the reference
      globalSQL = null;
      globalDb = null;
      isInitialized = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error);
    }
  }
};
