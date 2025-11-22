import type postgres from 'postgres';
import { z } from 'zod';
import type { Logger } from '../logger';
import { Err, Ok, type Result } from '../result';
import type { SqlDb, SqlTransaction } from './sql-db';

/**
 * Schema for validating that a transaction object has an unsafe method
 */
const transactionSchema = z.object({
  unsafe: z.function().args(z.string(), z.array(z.unknown())).returns(z.promise(z.unknown())),
});

/**
 * Schema for validating execute result which may have count/rowCount or be an array
 */
const executeResultSchema = z.union([
  z.object({
    count: z.number().optional(),
    rowCount: z.number().optional(),
  }),
  z.array(z.unknown()),
]);

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
      // Validate transaction object structure
      const validatedTx = transactionSchema.parse(this.tx);
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      const result = await validatedTx.unsafe(query, validatedParams);
      const resultArray = Array.isArray(result) ? result : [];
      this.logger.debug('Query executed successfully', { rowCount: resultArray.length });

      // Validate each row against the schema
      const validatedRows: T[] = [];
      for (const row of resultArray) {
        try {
          validatedRows.push(schema.parse(row));
        } catch (validationError) {
          const validationMessage =
            validationError instanceof z.ZodError
              ? validationError.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
              : validationError instanceof Error
                ? validationError.message
                : String(validationError);
          this.logger.error('Row validation failed in transaction', {
            query,
            error: validationMessage,
            row,
          });
          return Err(`Row validation failed: ${validationMessage}`);
        }
      }

      return Ok(validatedRows);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to execute query in transaction', {
        query,
        error: errorMessage,
      });
      return Err(`Failed to execute query: ${errorMessage}`);
    }
  }

  async execute(query: string, params?: unknown[]): Promise<Result<{ rowCount: number }, string>> {
    this.logger.debug('Executing command in transaction', {
      query,
      paramCount: params?.length ?? 0,
    });
    try {
      // Validate transaction object structure
      const validatedTx = transactionSchema.parse(this.tx);
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      const result = await validatedTx.unsafe(query, validatedParams);
      // For INSERT/UPDATE/DELETE with RETURNING, postgres returns rows
      // For INSERT/UPDATE/DELETE without RETURNING, postgres returns empty array
      // The result may have a count property for affected rows
      // If unavailable, we use array length or 0 as fallback
      const resultWithCount = executeResultSchema.parse(result);
      const rowCount =
        (Array.isArray(resultWithCount) ? undefined : resultWithCount.count) ??
        (Array.isArray(resultWithCount) ? undefined : resultWithCount.rowCount) ??
        (Array.isArray(resultWithCount) ? resultWithCount.length : 0);
      this.logger.debug('Command executed successfully', { rowCount });
      return Ok({ rowCount });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to execute command in transaction', {
        query,
        error: errorMessage,
      });
      return Err(`Failed to execute command: ${errorMessage}`);
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
      // Validate transaction object structure
      const validatedTx = transactionSchema.parse(this.tx);
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      const result = await validatedTx.unsafe(query, validatedParams);

      // If schema provided, validate the result
      if (schema) {
        try {
          const validated = schema.parse(result);
          this.logger.debug('Unsafe query executed and validated successfully');
          return Ok(validated);
        } catch (validationError) {
          const validationMessage =
            validationError instanceof z.ZodError
              ? validationError.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
              : validationError instanceof Error
                ? validationError.message
                : String(validationError);
          this.logger.error('Result validation failed in transaction', {
            query,
            error: validationMessage,
            result,
          });
          return Err(`Result validation failed: ${validationMessage}`);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to execute unsafe query in transaction', {
        query,
        error: errorMessage,
      });
      return Err(`Failed to execute unsafe query: ${errorMessage}`);
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
          const validationMessage =
            validationError instanceof z.ZodError
              ? validationError.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
              : validationError instanceof Error
                ? validationError.message
                : String(validationError);
          this.logger.error('Row validation failed', {
            query,
            error: validationMessage,
            row,
          });
          return Err(`Row validation failed: ${validationMessage}`);
        }
      }

      return Ok(validatedRows);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to execute query', { query, error: errorMessage });
      return Err(`Failed to execute query: ${errorMessage}`);
    }
  }

  async execute(query: string, params?: unknown[]): Promise<Result<{ rowCount: number }, string>> {
    this.logger.debug('Executing command', { query, paramCount: params?.length ?? 0 });
    try {
      // Validate params
      const validatedParams = params ? paramsSchema.parse(params) : [];
      const result = await this.sql.unsafe(query, toPostgresParams(validatedParams));
      // For INSERT/UPDATE/DELETE with RETURNING, postgres returns rows
      // For INSERT/UPDATE/DELETE without RETURNING, postgres returns empty array
      // The result may have a count property for affected rows
      // If unavailable, we use array length or 0 as fallback
      const resultWithCount = executeResultSchema.parse(result);
      const rowCount =
        (Array.isArray(resultWithCount) ? undefined : resultWithCount.count) ??
        (Array.isArray(resultWithCount) ? undefined : resultWithCount.rowCount) ??
        (Array.isArray(resultWithCount) ? resultWithCount.length : 0);
      this.logger.debug('Command executed successfully', { rowCount });
      return Ok({ rowCount });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to execute command', { query, error: errorMessage });
      return Err(`Failed to execute command: ${errorMessage}`);
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
          const validationMessage =
            validationError instanceof z.ZodError
              ? validationError.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
              : validationError instanceof Error
                ? validationError.message
                : String(validationError);
          this.logger.error('Result validation failed', {
            query,
            error: validationMessage,
            result,
          });
          return Err(`Result validation failed: ${validationMessage}`);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to execute unsafe query', { query, error: errorMessage });
      return Err(`Failed to execute unsafe query: ${errorMessage}`);
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
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Transaction failed, rolled back', { error: errorMessage });
      return Err(`Transaction failed: ${errorMessage}`);
    }
  }

  async close(): Promise<Result<void, string>> {
    this.logger.info('Closing database connection');
    try {
      await this.sql.end();
      this.logger.info('Database connection closed successfully');
      return Ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to close database connection', { error: errorMessage });
      return Err(`Failed to close database connection: ${errorMessage}`);
    }
  }
}
