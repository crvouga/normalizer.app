import type postgres from 'postgres';
import { z } from 'zod';
import { handleError } from '../error';
import type { Logger } from '../logger';
import { Ok, type Result } from '../result';
import type { SqlDb, SqlTransaction } from './sql-db';

/**
 * Type assertion for postgres transaction object
 * The postgres library guarantees the transaction object has an unsafe method
 */
type PostgresTransaction = {
  unsafe: (query: string, params: never[]) => Promise<unknown>;
};

/**
 * Helper to extract row count from execute result
 * For INSERT/UPDATE/DELETE with RETURNING, postgres returns the rows
 * For INSERT/UPDATE/DELETE without RETURNING, postgres returns empty array
 * We modify queries to add RETURNING to get the actual row count
 */
function extractRowCount(result: unknown): number {
  // If result is an array, the length is the row count (from RETURNING clause)
  if (Array.isArray(result)) {
    return result.length;
  }
  // If result is an object, check for count/rowCount properties
  if (typeof result === 'object' && result !== null) {
    const obj = result as Record<string, unknown>;
    if (typeof obj.count === 'number') {
      return obj.count;
    }
    if (typeof obj.rowCount === 'number') {
      return obj.rowCount;
    }
  }
  return 0;
}

/**
 * Modifies INSERT/UPDATE/DELETE queries to add RETURNING * if not present
 * This allows us to get the row count. Skips DDL statements.
 */
function addReturningIfNeeded(query: string): string {
  const trimmedQuery = query.trim();
  const upperQuery = trimmedQuery.toUpperCase();

  // Skip DDL statements (CREATE, DROP, ALTER, etc.)
  const ddlKeywords = ['CREATE', 'DROP', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE'];
  if (ddlKeywords.some((keyword) => upperQuery.startsWith(keyword))) {
    return query;
  }

  const isInsert = upperQuery.startsWith('INSERT');
  const isUpdate = upperQuery.startsWith('UPDATE');
  const isDelete = upperQuery.startsWith('DELETE');

  if ((isInsert || isUpdate || isDelete) && !upperQuery.includes('RETURNING')) {
    // Find the end of the query (before semicolon if present)
    const semicolonIndex = trimmedQuery.lastIndexOf(';');
    const queryWithoutSemicolon =
      semicolonIndex !== -1 ? trimmedQuery.slice(0, semicolonIndex).trim() : trimmedQuery.trim();

    // Add RETURNING * before semicolon or at the end
    const modifiedQuery = queryWithoutSemicolon + ' RETURNING *';
    return semicolonIndex !== -1 ? modifiedQuery + ';' : modifiedQuery;
  }

  return query;
}

/**
 * Schema for validating params array
 */
const paramsSchema = z.array(z.unknown());

/**
 * Helper function to convert validated params to the type expected by postgres library.
 * We validate with Zod first to ensure type safety at runtime, then convert for the type system.
 * The postgres library's type definitions require never[] but accept unknown[] at runtime.
 */
function toPostgresParams(params: unknown[]): never[] {
  // We've already validated with Zod that params is an array
  // This type assertion is necessary for the postgres library's type system
  // but is safe because we've validated the structure at runtime
  return params as never[];
}

/**
 * Postgres implementation of SqlTransaction using the postgres library.
 * Executes queries within a database transaction.
 */
class PostgresSqlTransaction implements SqlTransaction {
  constructor(
    private readonly tx: unknown, // postgres transaction type (TransactionSql)
    private readonly logger: Logger,
  ) {}

  async query<T>(
    query: string,
    schema: z.ZodType<T>,
    params?: unknown[],
  ): Promise<Result<T[], string>> {
    this.logger.debug('Executing query in transaction', { query, paramCount: params?.length ?? 0 });
    try {
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      // The postgres library guarantees the transaction has an unsafe method
      const tx = this.tx as PostgresTransaction;
      const result = await tx.unsafe(query, validatedParams as never[]);
      const resultArray = Array.isArray(result) ? result : [];
      this.logger.debug('Query executed successfully', { rowCount: resultArray.length });

      // Validate each row against the schema
      const validatedRows: T[] = [];
      for (const row of resultArray) {
        try {
          validatedRows.push(schema.parse(row));
        } catch (validationError) {
          return handleError(validationError, {
            logger: this.logger,
            logMessage: 'Row validation failed in transaction',
            context: { query, row },
            errorPrefix: 'Row validation failed',
          });
        }
      }

      return Ok(validatedRows);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute query in transaction',
        context: { query, paramCount: params?.length ?? 0 },
        errorPrefix: 'Failed to execute query',
      });
    }
  }

  async execute(query: string, params?: unknown[]): Promise<Result<{ rowCount: number }, string>> {
    this.logger.debug('Executing command in transaction', {
      query,
      paramCount: params?.length ?? 0,
    });
    try {
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      // Modify query to add RETURNING if needed to get row count
      const modifiedQuery = addReturningIfNeeded(query);
      // The postgres library guarantees the transaction has an unsafe method
      const tx = this.tx as PostgresTransaction;
      const result = await tx.unsafe(modifiedQuery, validatedParams as never[]);
      // Extract row count from result
      const rowCount = extractRowCount(result);
      this.logger.debug('Command executed successfully', { rowCount });
      return Ok({ rowCount });
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute command in transaction',
        context: { query, paramCount: params?.length ?? 0 },
        errorPrefix: 'Failed to execute command',
      });
    }
  }

  async unsafe<T = unknown>(
    query: string,
    params?: unknown[],
    schema?: z.ZodType<T>,
  ): Promise<Result<T, string>> {
    this.logger.debug('Executing unsafe query in transaction', {
      query,
      paramCount: params?.length ?? 0,
    });
    try {
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      // The postgres library guarantees the transaction has an unsafe method
      const tx = this.tx as PostgresTransaction;
      const result = await tx.unsafe(query, validatedParams as never[]);

      // If schema provided, validate the result
      if (schema) {
        try {
          const validated = schema.parse(result);
          this.logger.debug('Unsafe query executed and validated successfully');
          return Ok(validated);
        } catch (validationError) {
          return handleError(validationError, {
            logger: this.logger,
            logMessage: 'Result validation failed in transaction',
            context: { query, result },
            errorPrefix: 'Result validation failed',
          });
        }
      }

      // Without schema, validate as unknown and return
      // The caller should provide a schema if they need type safety
      this.logger.debug('Unsafe query executed successfully');
      // Validate result is at least unknown (this is a no-op but ensures type safety)
      const validatedResult = z.unknown().parse(result);
      // When T is unknown (the default), this is safe. When T is something else,
      // the caller should provide a schema for proper type safety
      return Ok(validatedResult as T);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute unsafe query in transaction',
        context: { query, paramCount: params?.length ?? 0 },
        errorPrefix: 'Failed to execute unsafe query',
      });
    }
  }
}

/**
 * Postgres implementation of SqlDb using the postgres library.
 * Provides a transaction-first interface for PostgreSQL database operations.
 */
export class PostgresSqlDb implements SqlDb {
  private readonly logger: Logger;

  constructor(
    private readonly sql: ReturnType<typeof postgres>,
    logger: Logger,
  ) {
    this.logger = logger;
    this.logger.info('Initialized PostgresSqlDb');
  }

  async query<T>(
    query: string,
    schema: z.ZodType<T>,
    params?: unknown[],
  ): Promise<Result<T[], string>> {
    this.logger.debug('Executing query', { query, paramCount: params?.length ?? 0 });
    try {
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      const result = await this.sql.unsafe(query, toPostgresParams(validatedParams));
      const resultArray = Array.isArray(result) ? result : [];
      this.logger.debug('Query executed successfully', {
        rowCount: resultArray.length,
      });

      // Validate each row against the schema
      const validatedRows: T[] = [];
      for (const row of resultArray) {
        try {
          validatedRows.push(schema.parse(row));
        } catch (validationError) {
          return handleError(validationError, {
            logger: this.logger,
            logMessage: 'Row validation failed',
            context: { query, row },
            errorPrefix: 'Row validation failed',
          });
        }
      }

      return Ok(validatedRows);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute query',
        context: { query, paramCount: params?.length ?? 0 },
        errorPrefix: 'Failed to execute query',
      });
    }
  }

  async execute(query: string, params?: unknown[]): Promise<Result<{ rowCount: number }, string>> {
    this.logger.debug('Executing command', { query, paramCount: params?.length ?? 0 });
    try {
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      // Modify query to add RETURNING if needed to get row count
      const modifiedQuery = addReturningIfNeeded(query);
      const result = await this.sql.unsafe(modifiedQuery, toPostgresParams(validatedParams));
      // Extract row count from result
      const rowCount = extractRowCount(result);
      this.logger.debug('Command executed successfully', { rowCount });
      return Ok({ rowCount });
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute command',
        context: { query, paramCount: params?.length ?? 0 },
        errorPrefix: 'Failed to execute command',
      });
    }
  }

  async unsafe<T = unknown>(
    query: string,
    params?: unknown[],
    schema?: z.ZodType<T>,
  ): Promise<Result<T, string>> {
    this.logger.debug('Executing unsafe query', { query, paramCount: params?.length ?? 0 });
    try {
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      const result = await this.sql.unsafe(query, toPostgresParams(validatedParams));

      // If schema provided, validate the result
      if (schema) {
        try {
          const validated = schema.parse(result);
          this.logger.debug('Unsafe query executed and validated successfully');
          return Ok(validated);
        } catch (validationError) {
          return handleError(validationError, {
            logger: this.logger,
            logMessage: 'Result validation failed',
            context: { query, result },
            errorPrefix: 'Result validation failed',
          });
        }
      }

      // Without schema, validate as unknown and return
      // The caller should provide a schema if they need type safety
      this.logger.debug('Unsafe query executed successfully');
      // Validate result is at least unknown (this is a no-op but ensures type safety)
      const validatedResult = z.unknown().parse(result);
      // When T is unknown (the default), this is safe. When T is something else,
      // the caller should provide a schema for proper type safety
      return Ok(validatedResult as T);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute unsafe query',
        context: { query, paramCount: params?.length ?? 0 },
        errorPrefix: 'Failed to execute unsafe query',
      });
    }
  }

  async begin<T>(
    callback: (tx: SqlTransaction) => Promise<Result<T, string>>,
  ): Promise<Result<T, string>> {
    this.logger.debug('Starting transaction');
    try {
      const result = await this.sql.begin(async (tx) => {
        const postgresTx = new PostgresSqlTransaction(tx, this.logger);
        const callbackResult = await callback(postgresTx);

        // If callback returned an error, throw to trigger rollback
        if (callbackResult.tag === 'err') {
          throw new Error(callbackResult.error);
        }

        // Return the value on success
        return callbackResult.value;
      });

      this.logger.debug('Transaction committed successfully');
      // The result comes from the callback which already validated it
      // We validate it's at least unknown to ensure type safety
      const validatedResult = z.unknown().parse(result);
      return Ok(validatedResult as T);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Transaction failed, rolled back',
        errorPrefix: 'Transaction failed',
      });
    }
  }

  async close(): Promise<Result<void, string>> {
    this.logger.info('Closing database connection');
    try {
      await this.sql.end();
      this.logger.info('Database connection closed successfully');
      return Ok(undefined);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to close database connection',
        errorPrefix: 'Failed to close database connection',
      });
    }
  }
}
