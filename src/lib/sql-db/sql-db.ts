import type { z } from 'zod';
import type { Result } from '../result';

/**
 * Transaction interface for executing queries within a database transaction.
 * All operations within a transaction are automatically committed on success
 * or rolled back on error.
 */
export interface SqlTransaction {
  /**
   * Executes a SQL query and returns the resulting rows, validated against a Zod schema.
   * Use this for SELECT queries that return data.
   *
   * @param query The SQL query string (optionally with placeholders like $1, $2)
   * @param schema Zod schema to validate each row against
   * @param params Parameters for the query, if any
   * @returns Result containing array of validated result rows, or an error message
   */
  query<T>(query: string, schema: z.ZodType<T>, params?: unknown[]): Promise<Result<T[], string>>;

  /**
   * Executes a SQL command that modifies data and returns the number of affected rows.
   * Use this for INSERT, UPDATE, DELETE, and DDL statements.
   *
   * @param query The SQL query string (optionally with placeholders like $1, $2)
   * @param params Parameters for the command, if any
   * @returns Result containing the number of affected rows, or an error message
   */
  execute(query: string, params?: unknown[]): Promise<Result<{ rowCount: number }, string>>;

  /**
   * Executes raw SQL with optional type safety via Zod schema.
   * Use this for DDL statements, complex queries, or cases that don't fit query/execute.
   *
   * @param query The SQL query string (optionally with placeholders like $1, $2)
   * @param params Parameters for the query, if any
   * @param schema Optional Zod schema to validate the result against
   * @returns Result containing the raw query result (validated if schema provided), or an error message
   */
  unsafe<T = unknown>(
    query: string,
    params?: unknown[],
    schema?: z.ZodType<T>,
  ): Promise<Result<T, string>>;
}

/**
 * Database interface for executing SQL queries with transaction support.
 * Provides a simple, app-agnostic abstraction over SQL database backends.
 */
export interface SqlDb {
  /**
   * Executes a SQL query and returns the resulting rows, validated against a Zod schema.
   * Use this for SELECT queries that return data.
   *
   * @param query The SQL query string (optionally with placeholders like $1, $2)
   * @param schema Zod schema to validate each row against
   * @param params Parameters for the query, if any
   * @returns Result containing array of validated result rows, or an error message
   */
  query<T>(query: string, schema: z.ZodType<T>, params?: unknown[]): Promise<Result<T[], string>>;

  /**
   * Executes a SQL command that modifies data and returns the number of affected rows.
   * Use this for INSERT, UPDATE, DELETE, and DDL statements.
   *
   * @param query The SQL query string (optionally with placeholders like $1, $2)
   * @param params Parameters for the command, if any
   * @returns Result containing the number of affected rows, or an error message
   */
  execute(query: string, params?: unknown[]): Promise<Result<{ rowCount: number }, string>>;

  /**
   * Executes raw SQL with optional type safety via Zod schema.
   * Use this for DDL statements, complex queries, or cases that don't fit query/execute.
   *
   * @param query The SQL query string (optionally with placeholders like $1, $2)
   * @param params Parameters for the query, if any
   * @param schema Optional Zod schema to validate the result against
   * @returns Result containing the raw query result (validated if schema provided), or an error message
   */
  unsafe<T = unknown>(
    query: string,
    params?: unknown[],
    schema?: z.ZodType<T>,
  ): Promise<Result<T, string>>;

  /**
   * Begins a transaction and executes the callback.
   * The transaction is automatically committed on success or rolled back on error.
   *
   * @param callback Function that receives a SqlTransaction and returns a Result
   * @returns Result containing the callback's return value, or an error message
   */
  begin<T>(
    callback: (tx: SqlTransaction) => Promise<Result<T, string>>,
  ): Promise<Result<T, string>>;

  /**
   * Closes the database connection and releases resources.
   *
   * @returns Result indicating success or failure
   */
  close(): Promise<Result<void, string>>;
}
