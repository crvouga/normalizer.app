import type { Logger } from '../lib/logger';
import type { SqlDb } from '../lib/sql-db/sql-db';
import { PostgresSqlDb } from '../lib/sql-db/sql-db-postgres';
import { createPostgresConnection } from './postgres';

export const createSqlDb = async ({ logger }: { logger: Logger }): Promise<SqlDb> => {
  const sql = await createPostgresConnection({ logger });
  return new PostgresSqlDb(sql, logger);
};
