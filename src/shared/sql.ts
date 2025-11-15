import postgres from 'postgres';
import { drizzle, type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { Logger } from '../lib/logger';
import * as schema from '../db/schema';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

// Global connection instance to prevent multiple connections during hot reload
let globalDb: Db | null = null;
let globalSQL: ReturnType<typeof postgres> | null = null;
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
  const sql = postgres(dbUrlObj.toString());

  logger.info('Checking database health...');
  try {
    await sql`SELECT 1`;
    logger.info('Database connection successful');
  } catch (error) {
    logger.error('Database connection failed:', error as Record<string, unknown>);
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

// Get the underlying postgres connection
// This is needed for PostgresNotification to enable LISTEN/NOTIFY callbacks
export const getPostgresConnection = (): ReturnType<typeof postgres> | null => {
  return globalSQL;
};

// Cleanup function to close connections gracefully
export const cleanupDb = async (logger: Logger): Promise<void> => {
  if (globalSQL || globalDb) {
    try {
      logger.info('Closing database connection...');
      if (globalSQL) {
        await globalSQL.end();
      }
      globalSQL = null;
      globalDb = null;
      isInitialized = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error as Record<string, unknown>);
    }
  }
};
