import { z } from 'zod';
import type { Logger } from '../logger';
import { Err, Ok, isErr, isOk, type Result } from '../result';
import type { SqlDb, SqlTransaction } from '../sql-db/sql-db';

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
 * Client for querying PostgreSQL metadata using the SqlDb abstraction,
 * with dependency-injected logging.
 */
export class PostgresClient {
  constructor(
    private readonly db: SqlDb,
    private readonly logger: Logger,
  ) {}

  /**
   * Escape PostgreSQL identifier (table/column names)
   * Wraps in double quotes to handle special characters safely
   */
  escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Check if an object exists in the given schema.
   * Returns true if a table, view, or materialized view with the given name exists.
   */
  async viewExist(tableName: string, schema: string = 'public'): Promise<Result<boolean, string>> {
    this.logger.debug(`Checking if table/view/matview exists: ${schema}.${tableName}`);
    const result = await this.db.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = $1 AND table_name = $2

        UNION

        SELECT 1 FROM information_schema.views
        WHERE table_schema = $1 AND table_name = $2

        UNION

        SELECT 1 FROM pg_matviews
        WHERE schemaname = $1 AND matviewname = $2
      ) as exists
      `,
      z.object({ exists: z.boolean() }),
      [schema, tableName],
    );

    if (!isOk(result)) {
      this.logger.error(`Failed to check if table/view/matview exists: ${result.error}`);
      return Err(`Failed to check if table/view/matview exists: ${result.error}`);
    }

    this.logger.debug(
      `Object exists result for ${schema}.${tableName}: ${result.value[0]?.exists ?? false}`,
    );
    return Ok(result.value[0]?.exists ?? false);
  }

  async getTableSchema(
    tableName: string,
    schema: string = 'public',
  ): Promise<Result<ColumnMetadata[], string>> {
    this.logger.debug(`Getting schema for table: ${schema}.${tableName}`);
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
      this.logger.error(`Failed to get table schema: ${result.error}`);
      return Err(`Failed to get table schema: ${result.error}`);
    }

    return Ok(result.value);
  }

  async getTableRowCount(
    tableName: string,
    schema: string = 'public',
  ): Promise<Result<number, string>> {
    const escapedTableName = this.escapeIdentifier(tableName);
    const escapedSchema = this.escapeIdentifier(schema);

    this.logger.debug(`Getting row count for table: ${schema}.${tableName}`);
    const result = await this.db.query(
      `SELECT COUNT(*) as count FROM ${escapedSchema}.${escapedTableName}`,
      z.object({ count: z.number() }),
    );

    if (!isOk(result)) {
      this.logger.error(`Failed to get table row count: ${result.error}`);
      return Err(`Failed to get table row count: ${result.error}`);
    }

    if (result.value.length > 0) {
      this.logger.debug(`Row count for ${schema}.${tableName}: ${result.value[0]!.count}`);
      return Ok(result.value[0]!.count);
    }

    this.logger.debug(`Row count for ${schema}.${tableName} is 0 (empty table)`);
    return Ok(0);
  }

  async getTableRows<T>(
    tableName: string,
    rowSchema: z.ZodType<T>,
    schema: string = 'public',
    orderBy: string = 'ORDER BY 1',
  ): Promise<Result<T[], string>> {
    const escapedTableName = this.escapeIdentifier(tableName);
    const escapedSchema = this.escapeIdentifier(schema);

    this.logger.debug(`Getting all rows from table: ${schema}.${tableName} with order: ${orderBy}`);
    const result = await this.db.query(
      `SELECT * FROM ${escapedSchema}.${escapedTableName} ${orderBy}`,
      rowSchema,
    );

    if (!isOk(result)) {
      this.logger.error(`Failed to get table rows: ${result.error}`);
      return Err(`Failed to get table rows: ${result.error}`);
    }

    return Ok(result.value);
  }

  async dropTable(tableName: string, schema: string = 'public'): Promise<Result<void, string>> {
    const escapedTableName = this.escapeIdentifier(tableName);
    const escapedSchema = this.escapeIdentifier(schema);
    this.logger.info(`Dropping table if exists: ${schema}.${tableName}`);
    const result = await this.db.unsafe(
      `DROP TABLE IF EXISTS ${escapedSchema}.${escapedTableName}`,
    );

    if (!isOk(result)) {
      this.logger.error(`Failed to drop table: ${result.error}`);
      return Err(`Failed to drop table: ${result.error}`);
    }

    this.logger.info(`Table dropped: ${schema}.${tableName} (if existed)`);
    return Ok(undefined);
  }

  async createTable(
    tableName: string,
    columns: TableColumn[],
    schema: string = 'public',
  ): Promise<Result<void, string>> {
    this.logger.info(`Creating table: ${schema}.${tableName} with ${columns.length} columns`);
    if (columns.length === 0) {
      this.logger.error('Attempted to create table with no columns');
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
      this.logger.error(`Failed to create table: ${result.error}`);
      return Err(`Failed to create table: ${result.error}`);
    }

    this.logger.info(`Table created: ${schema}.${tableName}`);
    return Ok(undefined);
  }

  async truncateTable(tableName: string, schema: string = 'public'): Promise<Result<void, string>> {
    const escapedTableName = this.escapeIdentifier(tableName);
    const escapedSchema = this.escapeIdentifier(schema);
    this.logger.info(`Truncating table: ${schema}.${tableName}`);
    const result = await this.db.unsafe(`TRUNCATE TABLE ${escapedSchema}.${escapedTableName}`);

    if (!isOk(result)) {
      this.logger.error(`Failed to truncate table: ${result.error}`);
      return Err(`Failed to truncate table: ${result.error}`);
    }

    this.logger.info(`Table truncated: ${schema}.${tableName}`);
    return Ok(undefined);
  }

  async insertBatch(
    tableName: string,
    columns: string[],
    rows: (string | number | boolean | null)[][],
    schema: string = 'public',
  ): Promise<Result<number, string>> {
    if (rows.length === 0) {
      this.logger.info(`No rows provided to insert into ${schema}.${tableName}, skipping`);
      return Ok(0);
    }

    if (columns.length === 0) {
      this.logger.error('Attempted to insert into table with no columns');
      return Err('Cannot insert into table with no columns');
    }

    const escapedColumnNames = columns.map((col) => this.escapeIdentifier(col)).join(', ');
    const maxParamsPerQuery = 10_000;
    // Calculate optimal batch size based on column count
    // Ensure minimum batch size of 100 for better performance, but cap at 5000 for memory efficiency
    const calculatedBatchSize = Math.floor(maxParamsPerQuery / columns.length);
    const batchSize = Math.max(100, Math.min(calculatedBatchSize, 5000));

    this.logger.info(
      `Inserting ${rows.length} rows into ${schema}.${tableName} (batch size: ${batchSize})`,
    );

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
      this.logger.error(`Transaction failed during insert: ${transactionResult.error}`);
      return Err(`Transaction failed: ${transactionResult.error}`);
    }

    this.logger.info(`Inserted ${transactionResult.value} rows into ${schema}.${tableName}`);
    return transactionResult;
  }

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

    this.logger.debug(
      `Processing insert in batches for ${schema}.${tableName} (batch size: ${batchSize})`,
    );

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      this.logger.debug(
        `Inserting batch [${i + 1}, ${i + batch.length}] into ${schema}.${tableName}`,
      );
      const insertResult = await this.insertBatchInTransaction({
        tx,
        tableName,
        escapedColumnNames,
        batch,
        schema,
      });

      if (!isOk(insertResult)) {
        this.logger.error(
          `Failed to insert batch at rows [${i + 1}, ${i + batch.length}]: ${insertResult.error}`,
        );
        return Err(`Failed to insert batch: ${insertResult.error}`);
      }

      totalInserted += batch.length;
    }

    return Ok(totalInserted);
  }

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
    this.logger.debug(`Executing batch insert query for ${schema}.${tableName}: ${query}`);
    const insertResult = await tx.unsafe(query, values);

    if (!isOk(insertResult)) {
      this.logger.error(`Batch insert failed: ${insertResult.error}`);
      return Err(insertResult.error);
    }

    return Ok(undefined);
  }

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

  async copyFromCsv(
    tableName: string,
    columns: string[],
    csvData: string,
    schema: string = 'public',
  ): Promise<Result<number, string>> {
    if (columns.length === 0) {
      this.logger.error(`Cannot copy into table with no columns: ${schema}.${tableName}`);
      return Err('Cannot copy into table with no columns');
    }

    try {
      this.logger.info(`Starting CSV import into ${schema}.${tableName}...`);

      // Parse CSV data into rows
      // Split by newline and filter empty lines
      const lines = csvData
        .trim()
        .split('\n')
        .filter((line) => line.trim().length > 0);

      if (lines.length <= 1) {
        this.logger.info(`CSV has only header or empty for ${schema}.${tableName}, skipping`);
        return Ok(0);
      }

      // Skip the header line (first line)
      const dataLines = lines.slice(1);

      // Parse each line into values
      const rows: (string | null)[][] = [];
      for (const line of dataLines) {
        const values = this.parseCsvLine(line);
        // Pad or truncate to match column count
        while (values.length < columns.length) {
          values.push('');
        }
        const row = values.slice(0, columns.length).map((cell) => (cell === '' ? null : cell));
        rows.push(row);
      }

      // Use batch insert
      const insertResult = await this.insertBatch(tableName, columns, rows, schema);
      if (isErr(insertResult)) {
        this.logger.error(`Error while inserting CSV data: ${insertResult.error}`);
        return insertResult;
      }
      this.logger.info(
        `CSV import success: ${insertResult.value} rows into ${schema}.${tableName}`,
      );
      return insertResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to copy data: ${errorMessage}`);
      return Err(`Failed to copy data: ${errorMessage}`);
    }
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i]!;
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current);

    return result;
  }

  async copyFromStream(
    tableName: string,
    columns: string[],
    rowStream: AsyncGenerator<(string | null)[], void, unknown>,
    schema: string = 'public',
  ): Promise<Result<number, string>> {
    if (columns.length === 0) {
      this.logger.error(
        `Cannot copy from stream into table with no columns: ${schema}.${tableName}`,
      );
      return Err('Cannot copy into table with no columns');
    }

    return this.insertFromStream(tableName, columns, rowStream, schema);
  }

  private async insertFromStream(
    tableName: string,
    columns: string[],
    rowStream: AsyncGenerator<(string | null)[], void, unknown>,
    schema: string,
  ): Promise<Result<number, string>> {
    try {
      const maxParamsPerQuery = 10_000;
      const optimalBatchSize = Math.max(1, Math.floor(maxParamsPerQuery / columns.length));
      const batchSize = Math.min(optimalBatchSize, 5000);

      let totalInserted = 0;
      let batch: (string | null)[][] = [];

      const flushBatch = async () => {
        if (batch.length === 0) return;
        const insertResult = await this.insertBatch(tableName, columns, batch, schema);
        if (isErr(insertResult)) {
          this.logger.error(
            `Error while inserting stream batch into ${schema}.${tableName}: ${insertResult.error}`,
          );
          throw new Error(insertResult.error);
        }
        this.logger.debug(
          `Inserted another ${insertResult.value} rows into ${schema}.${tableName} from stream`,
        );
        totalInserted += insertResult.value;
        batch = [];
      };

      this.logger.info(
        `Beginning stream import into ${schema}.${tableName} (batch size: ${batchSize})`,
      );
      for await (const row of rowStream) {
        batch.push(row);
        if (batch.length >= batchSize) {
          await flushBatch();
        }
      }

      // Flush remaining rows
      await flushBatch();

      this.logger.info(
        `Stream import completed: ${totalInserted} rows inserted into ${schema}.${tableName}`,
      );

      return Ok(totalInserted);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to insert from stream: ${errorMessage}`);
      return Err(`Failed to insert from stream: ${errorMessage}`);
    }
  }

  /**
   * Sanitize identifier for SQL safety (table/column names)
   * Only allows alphanumeric characters and underscores, must start with letter or underscore
   */
  public static sanitizeIdentifier(identifier: string): string {
    // Remove any characters that aren't alphanumeric or underscore
    let sanitized = identifier.replace(/[^a-zA-Z0-9_]/g, '_');

    // Ensure it starts with a letter or underscore (not a number)
    if (/^\d/.test(sanitized)) {
      sanitized = `_${sanitized}`;
    }

    // Ensure it's not empty
    if (sanitized.length === 0) {
      sanitized = '_unnamed';
    }

    // PostgreSQL identifier limit is 63 characters
    if (sanitized.length > 63) {
      sanitized = sanitized.substring(0, 63);
    }

    return sanitized;
  }

  /**
   * Check if multiple views exist in the database
   */
  async viewsExist(
    viewNames: string[],
    schema: string = 'public',
  ): Promise<Result<null, ViewsExistsError>> {
    for (const viewName of viewNames) {
      const checkResult = await this.viewExist(viewName, schema);

      if (isErr(checkResult)) {
        this.logger.error('Failed to validate output view exists', {
          viewName,
          error: checkResult.error,
        });
        return Err({
          type: 'errored',
          error: checkResult.error,
          viewName,
        });
      }

      const exists = checkResult.value;
      if (!exists) {
        this.logger.error('Output view was not created', {
          viewName,
        });
        return Err({
          type: 'not-created',
          viewName,
        });
      }
    }

    return Ok(null);
  }
}

/**
 * Error type for view existence checks
 */
export type ViewsExistsError =
  | {
      type: 'errored';
      error: string;
      viewName: string;
    }
  | {
      type: 'not-created';
      viewName: string;
    };

export const createPostgresClient = (params: { db: SqlDb; logger: Logger }): PostgresClient => {
  const logger = params.logger.child(PostgresClient.name);
  return new PostgresClient(params.db, logger);
};
