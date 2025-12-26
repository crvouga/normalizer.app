import { z } from 'zod';
import { type ExecutableTool } from '../llm/agentic-loop';
import type { Logger } from '../logger';
import { isErr } from '../result';
import type { SqlDb } from '../sql-db/sql-db';

/**
 * Creates the query_database tool with logging of executed queries and errors.
 */
export function createQueryDatabaseTool({
  sqlDb,
  logger,
}: {
  sqlDb: SqlDb;
  logger: Logger;
}): ExecutableTool {
  const queryDatabaseSchema = z.object({
    query: z
      .string()
      .describe(
        'A SQL query to execute against the database. Can be SELECT queries to inspect schemas, or CREATE/DROP/ALTER statements to create views, materialized views, tables, indexes, etc.',
      ),
  });

  const queryDatabaseTool: ExecutableTool = {
    name: 'query_database',
    description:
      'Execute a SQL query (SELECT to inspect, CREATE to change the schema) against the PostgreSQL database.',
    parameters: queryDatabaseSchema,
    async execute(args) {
      const { query } = queryDatabaseSchema.parse(args);
      try {
        logger.debug('Executing query_database tool', { query });
        const result = await sqlDb.unsafe(query.trim());

        if (isErr(result)) {
          logger.warn('query_database tool error', { query, error: result.error });
          return JSON.stringify({ error: result.error });
        }

        const value = result.value;

        if (Array.isArray(value)) {
          logger.debug('query_database tool returned rows', { rowCount: value.length });
          return JSON.stringify({ rows: value });
        }

        if (value && typeof value === 'object' && 'rowCount' in value) {
          logger.debug('query_database tool result has rowCount', {
            rowCount: value.rowCount,
          });
          return JSON.stringify({ rowCount: value.rowCount });
        }

        logger.debug('query_database tool returned generic result', { result: value });
        return JSON.stringify({ result: value });
      } catch (err) {
        const errMsg =
          err instanceof Error ? err.message : typeof err === 'string' ? err : JSON.stringify(err);
        logger.error('Exception in query_database tool', { error: errMsg, query });
        return JSON.stringify({ error: errMsg });
      }
    },
  };

  return queryDatabaseTool;
}
