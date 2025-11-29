import { z } from 'zod';
import type { SqlDb } from '../sql-db/sql-db';
import { Err, Ok, isOk, type Result } from '../result';

/**
 * Metadata for a PostgreSQL table column
 */
export interface ColumnMetadata {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

/**
 * Client for querying PostgreSQL metadata using the SqlDb abstraction.
 * Provides methods for inspecting tables, schemas, and data.
 */
export class PostgresMetadataClient {
  constructor(private readonly db: SqlDb) {}

  /**
   * Escape PostgreSQL identifier (table/column names)
   * Wraps in double quotes to handle special characters safely
   */
  private escapeIdentifier(identifier: string): string {
    // Replace any double quotes with escaped version and wrap in quotes
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Check if a table exists in the specified schema
   * @param tableName - Name of the table to check
   * @param schema - Schema name (defaults to 'public')
   * @returns Result containing true if table exists, false otherwise, or an error
   */
  async tableExists(
    tableName: string,
    schema: string = 'public',
  ): Promise<Result<boolean, string>> {
    const result = await this.db.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = $2
      ) as exists`,
      z.object({ exists: z.boolean() }),
      [schema, tableName],
    );

    if (!isOk(result)) {
      return Err(`Failed to check if table exists: ${result.error}`);
    }

    return Ok(result.value[0]?.exists ?? false);
  }

  /**
   * Get table column metadata (schema information)
   * @param tableName - Name of the table
   * @param schema - Schema name (defaults to 'public')
   * @returns Result containing array of column metadata, or an error
   */
  async getTableSchema(
    tableName: string,
    schema: string = 'public',
  ): Promise<Result<ColumnMetadata[], string>> {
    const result = await this.db.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2
       ORDER BY ordinal_position`,
      z.object({
        column_name: z.string(),
        data_type: z.string(),
        is_nullable: z.string(),
      }),
      [schema, tableName],
    );

    if (!isOk(result)) {
      return Err(`Failed to get table schema: ${result.error}`);
    }

    return Ok(result.value);
  }

  /**
   * Get the number of rows in a table
   * @param tableName - Name of the table
   * @param schema - Schema name (defaults to 'public')
   * @returns Result containing row count, or an error
   */
  async getTableRowCount(
    tableName: string,
    schema: string = 'public',
  ): Promise<Result<number, string>> {
    const escapedTableName = this.escapeIdentifier(tableName);
    const escapedSchema = this.escapeIdentifier(schema);
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM ${escapedSchema}.${escapedTableName}`,
      z.object({ count: z.number() }),
    );

    if (!isOk(result)) {
      return Err(`Failed to get table row count: ${result.error}`);
    }

    if (result.value.length > 0) {
      return Ok(result.value[0]!.count);
    }

    return Ok(0);
  }

  /**
   * Get all rows from a table with schema validation
   * @param tableName - Name of the table
   * @param rowSchema - Zod schema to validate each row against
   * @param schema - Schema name (defaults to 'public')
   * @param orderBy - Optional ORDER BY clause (defaults to 'ORDER BY 1')
   * @returns Result containing array of validated rows, or an error
   */
  async getTableRows<T>(
    tableName: string,
    rowSchema: z.ZodType<T>,
    schema: string = 'public',
    orderBy: string = 'ORDER BY 1',
  ): Promise<Result<T[], string>> {
    const escapedTableName = this.escapeIdentifier(tableName);
    const escapedSchema = this.escapeIdentifier(schema);
    const result = await this.db.query(
      `SELECT * FROM ${escapedSchema}.${escapedTableName} ${orderBy}`,
      rowSchema,
    );

    if (!isOk(result)) {
      return Err(`Failed to get table rows: ${result.error}`);
    }

    return Ok(result.value);
  }
}
