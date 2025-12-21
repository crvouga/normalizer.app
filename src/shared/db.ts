import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import { drizzle, type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema';
import type { Logger } from '../lib/logger';
import { onShutdown } from '../lib/process/on-shutdown';
import { createPostgresConnection } from './postgres-connection';

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export type Tx = PgTransaction<
  PostgresJsQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

// Global connection instance to prevent multiple connections during hot reload
let globalDb: Db | null = null;
let globalPostgres: ReturnType<typeof postgres> | null = null;
let isInitialized = false;

export const createDb = async ({ logger }: { logger: Logger }): Promise<Db> => {
  // Return existing connection if available and healthy
  if (globalDb && globalPostgres && isInitialized) {
    try {
      await globalPostgres`SELECT 1`;
      logger.info('Reusing existing database connection');
      return globalDb;
    } catch (error) {
      logger.warn('Existing connection is unhealthy, creating new one', {
        error,
      });
      globalDb = null;
      globalPostgres = null;
      isInitialized = false;
    }
  }

  const postgres = await createPostgresConnection({ logger });

  // Create Drizzle instance
  const db = drizzle(postgres, { schema });

  onShutdown(logger, async () => {
    await cleanupDb(logger);
  });

  // Only apply schema if not already initialized
  if (!isInitialized) {
    isInitialized = true;
  }

  globalPostgres = postgres;
  globalDb = db;
  return db;
};

// Get the underlying postgres connection
// This is needed for PostgresNotification to enable LISTEN/NOTIFY callbacks
export const getPostgresConnection = (): ReturnType<typeof postgres> | null => {
  return globalPostgres;
};

// Cleanup function to close connections gracefully
export const cleanupDb = async (logger: Logger): Promise<void> => {
  if (globalPostgres || globalDb) {
    try {
      logger.info('Closing database connection...');
      if (globalPostgres) {
        await globalPostgres.end();
      }
      globalPostgres = null;
      globalDb = null;
      isInitialized = false;
      logger.info('Database connection closed');
    } catch (error) {
      logger.error('Error closing database connection:', error as Record<string, unknown>);
    }
  }
};
