import { z } from 'zod';
import type { SqlDb, SqlTransaction } from '../sql-db/sql-db';
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
 * Column definition for creating PostgreSQL tables
 */
export interface TableColumn {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'NUMERIC' | 'BOOLEAN' | 'DATE' | 'TIMESTAMP';
  nullable?: boolean;
}

/**
 * Client for querying PostgreSQL metadata using the SqlDb abstraction.
 * Provides methods for inspecting tables, schemas, and data.
 */
export class PostgresClient {
  constructor(private readonly db: SqlDb) {}

  /**
   * Escape PostgreSQL identifier (table/column names)
   * Wraps in double quotes to handle special characters safely
   */
  escapeIdentifier(identifier: string): string {
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

  /**
   * Drop a table if it exists
   * @param tableName - Name of the table to drop
   * @param schema - Schema name (defaults to 'public')
   * @returns Result indicating success or failure
   */
  async dropTable(tableName: string, schema: string = 'public'): Promise<Result<void, string>> {
    const escapedTableName = this.escapeIdentifier(tableName);
    const escapedSchema = this.escapeIdentifier(schema);
    const result = await this.db.unsafe(
      `DROP TABLE IF EXISTS ${escapedSchema}.${escapedTableName}`,
    );

    if (!isOk(result)) {
      return Err(`Failed to drop table: ${result.error}`);
    }

    return Ok(undefined);
  }

  /**
   * Create a table with the specified columns
   * @param tableName - Name of the table to create
   * @param columns - Array of column definitions
   * @param schema - Schema name (defaults to 'public')
   * @returns Result indicating success or failure
   */
  async createTable(
    tableName: string,
    columns: TableColumn[],
    schema: string = 'public',
  ): Promise<Result<void, string>> {
    if (columns.length === 0) {
      return Err('Cannot create table with no columns');
    }

    const columnDefinitions = columns
      .map((col) => {
        const nullable = col.nullable !== false ? '' : 'NOT NULL';
        return `${this.escapeIdentifier(col.name)} ${col.type} ${nullable}`.trim();
      })
      .join(', ');

    const escapedTableName = this.escapeIdentifier(tableName);
    const escapedSchema = this.escapeIdentifier(schema);
    const result = await this.db.unsafe(
      `CREATE TABLE ${escapedSchema}.${escapedTableName} (${columnDefinitions})`,
    );

    if (!isOk(result)) {
      return Err(`Failed to create table: ${result.error}`);
    }

    return Ok(undefined);
  }

  /**
   * Truncate a table (remove all rows)
   * @param tableName - Name of the table to truncate
   * @param schema - Schema name (defaults to 'public')
   * @returns Result indicating success or failure
   */
  async truncateTable(tableName: string, schema: string = 'public'): Promise<Result<void, string>> {
    const escapedTableName = this.escapeIdentifier(tableName);
    const escapedSchema = this.escapeIdentifier(schema);
    const result = await this.db.unsafe(`TRUNCATE TABLE ${escapedSchema}.${escapedTableName}`);

    if (!isOk(result)) {
      return Err(`Failed to truncate table: ${result.error}`);
    }

    return Ok(undefined);
  }

  /**
   * Insert a batch of rows into a table using parameterized queries
   * Processes rows in batches to stay within parameter limits (max 10,000 parameters per query)
   * and handles transaction internally
   * @param tableName - Name of the table
   * @param columns - Array of column names
   * @param rows - Array of row data (each row is an array of values)
   * @param schema - Schema name (defaults to 'public')
   * @returns Result containing the total number of rows inserted, or an error
   */
  async insertBatch(
    tableName: string,
    columns: string[],
    rows: (string | number | boolean | null)[][],
    schema: string = 'public',
  ): Promise<Result<number, string>> {
    if (rows.length === 0) return Ok(0);

    if (columns.length === 0) return Err('Cannot insert into table with no columns');

    const escapedColumnNames = columns.map((col) => this.escapeIdentifier(col)).join(', ');
    const maxParamsPerQuery = 10_000;
    const batchSize = Math.max(1, Math.floor(maxParamsPerQuery / columns.length));

    const transactionResult = await this.db.begin(async (tx) => {
      return this.processBatchesInTransaction({
        tx,
        tableName,
        escapedColumnNames,
        rows,
        batchSize,
        schema,
      });
    });

    if (!isOk(transactionResult)) {
      return Err(`Transaction failed: ${transactionResult.error}`);
    }

    return transactionResult;
  }

  /**
   * Process all batches within a transaction
   */
  private async processBatchesInTransaction({
    tx,
    tableName,
    escapedColumnNames,
    rows,
    batchSize,
    schema,
  }: {
    tx: SqlTransaction;
    tableName: string;
    escapedColumnNames: string;
    rows: (string | number | boolean | null)[][];
    batchSize: number;
    schema: string;
  }): Promise<Result<number, string>> {
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const insertResult = await this.insertBatchInTransaction({
        tx,
        tableName,
        escapedColumnNames,
        batch,
        schema,
      });

      if (!isOk(insertResult)) {
        return Err(`Failed to insert batch: ${insertResult.error}`);
      }

      totalInserted += batch.length;
    }

    return Ok(totalInserted);
  }

  /**
   * Insert a single batch of rows within a transaction
   */
  private async insertBatchInTransaction({
    tx,
    tableName,
    escapedColumnNames,
    batch,
    schema,
  }: {
    tx: SqlTransaction;
    tableName: string;
    escapedColumnNames: string;
    batch: (string | number | boolean | null)[][];
    schema: string;
  }): Promise<Result<void, string>> {
    const { query, values } = this.buildBatchQuery({
      tableName,
      escapedColumnNames,
      batch,
      schema,
    });
    const insertResult = await tx.unsafe(query, values);

    if (!isOk(insertResult)) {
      return Err(insertResult.error);
    }

    return Ok(undefined);
  }

  /**
   * Build parameterized query and values array for a batch
   */
  private buildBatchQuery({
    tableName,
    escapedColumnNames,
    batch,
    schema,
  }: {
    tableName: string;
    escapedColumnNames: string;
    batch: (string | number | boolean | null)[][];
    schema: string;
  }): { query: string; values: (string | number | boolean | null)[] } {
    const placeholders: string[] = [];
    const values: (string | number | boolean | null)[] = [];
    const escapedTableName = this.escapeIdentifier(tableName);
    const escapedSchema = this.escapeIdentifier(schema);

    batch.forEach((row) => {
      const rowPlaceholders: string[] = [];
      row.forEach((cell) => {
        const paramIndex = values.length + 1;
        rowPlaceholders.push(`$${paramIndex}`);
        values.push(cell === '' ? null : cell);
      });
      placeholders.push(`(${rowPlaceholders.join(', ')})`);
    });

    const query = `INSERT INTO ${escapedSchema}.${escapedTableName} (${escapedColumnNames}) VALUES ${placeholders.join(', ')}`;
    return { query, values };
  }
}
