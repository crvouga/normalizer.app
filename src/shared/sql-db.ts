import type { Logger } from '../lib/logger';
import type { SqlDb } from '../lib/sql-db/sql-db';
import { PgliteSqlDb } from '../lib/sql-db/sql-db-pglite';
import { PostgresSqlDb } from '../lib/sql-db/sql-db-postgres';
import { createPostgresConnection } from './postgres-connection';

/**
 * Creates a PostgresSqlDb instance using the postgres library.
 */
export const createPostgresSqlDb = async ({ logger }: { logger: Logger }): Promise<SqlDb> => {
  const sql = await createPostgresConnection({ logger });
  return new PostgresSqlDb(sql, logger);
};

/**
 * Creates a PgliteSqlDb instance using the PGLite library (in-memory).
 */
export const createPgliteSqlDb = async ({ logger }: { logger: Logger }): Promise<SqlDb> => {
  const db = new PgliteSqlDb(logger);
  await db.waitReady();
  return db;
};

/**
 * Creates a SqlDb instance. Defaults to Postgres for backward compatibility.
 */
export const createSqlDb = async ({ logger }: { logger: Logger }): Promise<SqlDb> => {
  return createPostgresSqlDb({ logger });
};
