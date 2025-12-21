import { PGlite } from '@electric-sql/pglite';
import { z } from 'zod';
import { handleError } from '../error';
import type { Logger } from '../logger';
import { Ok, type Result } from '../result';
import type { SqlDb, SqlTransaction } from './sql-db';
import { addReturningIfNeeded, paramsSchema } from './sql-db-utils';

/**
 * Helper to extract rows from PGLite result
 * PGLite query() returns { rows: [], fields: [], affectedRows: number }
 * PGLite exec() returns an array containing result objects: [{ rows: [], fields: [], affectedRows: number }]
 */
function extractRows(result: unknown): unknown[] {
  if (Array.isArray(result)) {
    // Check if it's an array of result objects (from exec())
    if (result.length > 0 && typeof result[0] === 'object' && result[0] !== null) {
      const firstItem = result[0] as { rows?: unknown[] };
      if (Array.isArray(firstItem.rows)) {
        return firstItem.rows;
      }
    }
    // Otherwise it's already an array of rows
    return result;
  }
  if (typeof result === 'object' && result !== null) {
    const obj = result as { rows?: unknown[] };
    if (Array.isArray(obj.rows)) {
      return obj.rows;
    }
  }
  return [];
}

/**
 * Helper to truncate query string for logging when it has many parameters
 * Prevents logging massive queries that can cause performance issues
 */
function truncateQueryForLog(query: string, paramCount: number): string {
  // Truncate queries with many parameters or very long queries
  if (paramCount > 100 || query.length > 500) {
    const preview = query.substring(0, 100);
    return `${preview}... [truncated, ${query.length} chars, ${paramCount} params]`;
  }
  return query;
}

/**
 * PGLite implementation of SqlTransaction using the PGLite library.
 * Executes queries within a database transaction.
 * The transaction is started by the begin() method, so this class just executes queries.
 */
class PgliteSqlTransaction implements SqlTransaction {
  constructor(
    private readonly db: PGlite,
    private readonly logger: Logger,
  ) {}

  async query<T = unknown>(
    query: string,
    schema?: z.ZodType<T>,
    params?: unknown[],
  ): Promise<Result<T[], string>> {
    const paramCount = params?.length ?? 0;
    const queryForLog = truncateQueryForLog(query, paramCount);
    // Only log for small queries to avoid excessive logging
    if (paramCount < 100) {
      this.logger.debug('Executing query in transaction', { query: queryForLog, paramCount });
    }
    try {
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      // PGLite query() returns { rows, fields, affectedRows }
      const result = await this.db.query(query, validatedParams);
      const resultArray = extractRows(result);
      if (paramCount < 100) {
        this.logger.debug('Query executed successfully', { rowCount: resultArray.length });
      }

      // Use provided schema or default to unknown
      const validationSchema = schema ?? (z.unknown() as z.ZodType<T>);

      // Validate each row against the schema
      const validatedRows: T[] = [];
      for (const row of resultArray) {
        try {
          validatedRows.push(validationSchema.parse(row));
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
      const paramCount = params?.length ?? 0;
      const queryForLog = truncateQueryForLog(query, paramCount);
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute query in transaction',
        context: { query: queryForLog, paramCount },
        errorPrefix: 'Failed to execute query',
      });
    }
  }

  async execute(query: string, params?: unknown[]): Promise<Result<{ rowCount: number }, string>> {
    const paramCount = params?.length ?? 0;
    const queryForLog = truncateQueryForLog(query, paramCount);
    // Only log for small queries to avoid excessive logging
    if (paramCount < 100) {
      this.logger.debug('Executing command in transaction', {
        query: queryForLog,
        paramCount,
      });
    }
    try {
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      // Modify query to add RETURNING if needed to get row count
      const modifiedQuery = addReturningIfNeeded(query);
      // Use query() for parameterized queries, exec() for non-parameterized
      const result =
        validatedParams.length > 0
          ? await this.db.query(modifiedQuery, validatedParams)
          : await this.db.exec(modifiedQuery);
      // Extract rows and count them
      const rows = extractRows(result);
      const rowCount = rows.length;
      if (paramCount < 100) {
        this.logger.debug('Command executed successfully', { rowCount });
      }
      return Ok({ rowCount });
    } catch (error) {
      const paramCount = params?.length ?? 0;
      const queryForLog = truncateQueryForLog(query, paramCount);
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute command in transaction',
        context: { query: queryForLog, paramCount },
        errorPrefix: 'Failed to execute command',
      });
    }
  }

  async unsafe<T = unknown>(
    query: string,
    params?: unknown[],
    schema?: z.ZodType<T>,
  ): Promise<Result<T, string>> {
    const paramCount = params?.length ?? 0;
    const queryForLog = truncateQueryForLog(query, paramCount);
    // Only log for small queries to avoid excessive logging
    if (paramCount < 100) {
      this.logger.debug('Executing unsafe query in transaction', {
        query: queryForLog,
        paramCount,
      });
    }
    try {
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      // For SELECT queries, always use query() even without params
      // For other queries without params, use exec()
      const isSelect = query.trim().toUpperCase().startsWith('SELECT');
      const result =
        validatedParams.length > 0 || isSelect
          ? await this.db.query(query, validatedParams)
          : await this.db.exec(query);
      // Extract rows from result
      const resultData = extractRows(result);

      // If schema provided, validate the result
      if (schema) {
        try {
          const validated = schema.parse(resultData);
          if (paramCount < 100) {
            this.logger.debug('Unsafe query executed and validated successfully');
          }
          return Ok(validated);
        } catch (validationError) {
          return handleError(validationError, {
            logger: this.logger,
            logMessage: 'Result validation failed in transaction',
            context: { query, result: resultData },
            errorPrefix: 'Result validation failed',
          });
        }
      }

      // Without schema, validate as unknown and return
      // The caller should provide a schema if they need type safety
      if (paramCount < 100) {
        this.logger.debug('Unsafe query executed successfully');
      }
      // Validate result is at least unknown (this is a no-op but ensures type safety)
      const validatedResult = z.unknown().parse(resultData);
      // When T is unknown (the default), this is safe. When T is something else,
      // the caller should provide a schema for proper type safety
      return Ok(validatedResult as T);
    } catch (error) {
      const paramCount = params?.length ?? 0;
      const queryForLog = truncateQueryForLog(query, paramCount);
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute unsafe query in transaction',
        context: { query: queryForLog, paramCount },
        errorPrefix: 'Failed to execute unsafe query',
      });
    }
  }
}

/**
 * PGLite implementation of SqlDb using the PGLite library.
 * Provides a transaction-first interface for PostgreSQL database operations.
 */
export class PgliteSqlDb implements SqlDb {
  private readonly logger: Logger;
  private readonly db: PGlite;

  constructor(logger: Logger) {
    this.logger = logger.child(PgliteSqlDb.name);
    // Create in-memory PGLite instance
    this.db = new PGlite();
    this.logger.info('Initialized');
  }

  async waitReady(): Promise<void> {
    await this.db.waitReady;
  }

  async query<T = unknown>(
    query: string,
    schema?: z.ZodType<T>,
    params?: unknown[],
  ): Promise<Result<T[], string>> {
    const paramCount = params?.length ?? 0;
    const queryForLog = truncateQueryForLog(query, paramCount);
    // Only log for small queries to avoid excessive logging
    if (paramCount < 100) {
      this.logger.debug('Executing query', { query: queryForLog, paramCount });
    }
    try {
      // Ensure database is ready
      await this.db.waitReady;
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      // PGLite query() returns { rows, fields, affectedRows }
      const result = await this.db.query(query, validatedParams);
      const resultArray = extractRows(result);
      if (paramCount < 100) {
        this.logger.debug('Query executed successfully', {
          rowCount: resultArray.length,
        });
      }

      // Use provided schema or default to unknown
      const validationSchema = schema ?? (z.unknown() as z.ZodType<T>);

      // Validate each row against the schema
      const validatedRows: T[] = [];
      for (const row of resultArray) {
        try {
          validatedRows.push(validationSchema.parse(row));
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
      const paramCount = params?.length ?? 0;
      const queryForLog = truncateQueryForLog(query, paramCount);
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute query',
        context: { query: queryForLog, paramCount },
        errorPrefix: 'Failed to execute query',
      });
    }
  }

  async execute(query: string, params?: unknown[]): Promise<Result<{ rowCount: number }, string>> {
    const paramCount = params?.length ?? 0;
    const queryForLog = truncateQueryForLog(query, paramCount);
    // Only log for small queries to avoid excessive logging
    if (paramCount < 100) {
      this.logger.debug('Executing command', { query: queryForLog, paramCount });
    }
    try {
      // Ensure database is ready
      await this.db.waitReady;
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      // Modify query to add RETURNING if needed to get row count
      const modifiedQuery = addReturningIfNeeded(query);
      // Use query() for parameterized queries, exec() for non-parameterized
      const result =
        validatedParams.length > 0
          ? await this.db.query(modifiedQuery, validatedParams)
          : await this.db.exec(modifiedQuery);
      // Extract rows and count them
      const rows = extractRows(result);
      const rowCount = rows.length;
      if (paramCount < 100) {
        this.logger.debug('Command executed successfully', { rowCount });
      }
      return Ok({ rowCount });
    } catch (error) {
      const paramCount = params?.length ?? 0;
      const queryForLog = truncateQueryForLog(query, paramCount);
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute command',
        context: { query: queryForLog, paramCount },
        errorPrefix: 'Failed to execute command',
      });
    }
  }

  async unsafe<T = unknown>(
    query: string,
    params?: unknown[],
    schema?: z.ZodType<T>,
  ): Promise<Result<T, string>> {
    const paramCount = params?.length ?? 0;
    const queryForLog = truncateQueryForLog(query, paramCount);
    // Only log for small queries to avoid excessive logging
    if (paramCount < 100) {
      this.logger.debug('Executing unsafe query', { query: queryForLog, paramCount });
    }
    try {
      // Ensure database is ready
      await this.db.waitReady;
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      // Use query() for parameterized queries, exec() for non-parameterized
      const result =
        validatedParams.length > 0
          ? await this.db.query(query, validatedParams)
          : await this.db.exec(query);
      // Extract rows from result
      const resultData = extractRows(result);

      // If schema provided, validate the result
      if (schema) {
        try {
          const validated = schema.parse(resultData);
          if (paramCount < 100) {
            this.logger.debug('Unsafe query executed and validated successfully');
          }
          return Ok(validated);
        } catch (validationError) {
          return handleError(validationError, {
            logger: this.logger,
            logMessage: 'Result validation failed',
            context: { query, result: resultData },
            errorPrefix: 'Result validation failed',
          });
        }
      }

      // Without schema, validate as unknown and return
      // The caller should provide a schema if they need type safety
      if (paramCount < 100) {
        this.logger.debug('Unsafe query executed successfully');
      }
      // Validate result is at least unknown (this is a no-op but ensures type safety)
      const validatedResult = z.unknown().parse(resultData);
      // When T is unknown (the default), this is safe. When T is something else,
      // the caller should provide a schema for proper type safety
      return Ok(validatedResult as T);
    } catch (error) {
      const paramCount = params?.length ?? 0;
      const queryForLog = truncateQueryForLog(query, paramCount);
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to execute unsafe query',
        context: { query: queryForLog, paramCount },
        errorPrefix: 'Failed to execute unsafe query',
      });
    }
  }

  async begin<T>(
    callback: (tx: SqlTransaction) => Promise<Result<T, string>>,
  ): Promise<Result<T, string>> {
    this.logger.debug('Starting transaction');
    try {
      // Ensure database is ready
      await this.db.waitReady;
      // Start transaction using SQL BEGIN statement
      await this.db.exec('BEGIN');

      try {
        const pgliteTx = new PgliteSqlTransaction(this.db, this.logger);
        const callbackResult = await callback(pgliteTx);

        // If callback returned an error, rollback and return error
        if (callbackResult.tag === 'err') {
          await this.db.exec('ROLLBACK');
          return callbackResult;
        }

        // Commit transaction on success
        await this.db.exec('COMMIT');
        this.logger.debug('Transaction committed successfully');

        // Return the value on success
        const result = callbackResult.value;
        // The result comes from the callback which already validated it
        // We validate it's at least unknown to ensure type safety
        const validatedResult = z.unknown().parse(result);
        return Ok(validatedResult as T);
      } catch (error) {
        // Rollback on any error
        await this.db.exec('ROLLBACK');
        throw error;
      }
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
      await this.db.close();
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
