import { z } from 'zod';
import { parseCsv, type ColumnSchema } from '../csv/csv';
import type { Logger } from '../logger';
import type { ObjectStore } from '../object-store/object-store';
import { isOk, Ok, Err, type Result } from '../result';
import type { SqlDb } from '../sql-db/sql-db';
import { TabularDataConverter } from '../tabular-data-converter/tabular-data-converter';

/**
 * Tabular data structure with parsed data and schema
 */
export interface TabularData {
  data: Record<string, string | number | boolean | null>[];
  schema: ColumnSchema[];
}

/**
 * Options for loading tabular data into PostgreSQL
 */
export interface LoadOptions {
  /**
   * Table name to create/use (will be sanitized)
   */
  tableName: string;
  /**
   * Whether to drop the table if it already exists
   * @default false
   */
  dropIfExists?: boolean;
  /**
   * Whether to truncate the table before loading
   * @default false
   */
  truncate?: boolean;
}

/**
 * High-performance PostgreSQL loader for tabular data from object storage.
 * Converts data to CSV format, creates tables dynamically, and uses COPY for bulk loading.
 */
export class TabularDataPostgresLoader {
  private converter: TabularDataConverter;

  constructor(
    private readonly sql: SqlDb,
    private readonly logger: Logger,
    private readonly objectStore: ObjectStore,
  ) {
    this.converter = new TabularDataConverter({
      objectStore,
      logger,
    });
  }

  /**
   * Load tabular data from object store into PostgreSQL table.
   * This method:
   * 1. Converts the file to CSV format using TabularDataConverter
   * 2. Parses CSV to extract schema and data
   * 3. Creates the table dynamically
   * 4. Uses COPY FROM STDIN for maximum performance
   *
   * @param bucket - Object store bucket name
   * @param key - Object store key (file path)
   * @param options - Loading options including table name
   */
  async load(
    bucket: string,
    key: string,
    options: LoadOptions,
  ): Promise<Result<{ tableName: string; rowCount: number }, string>> {
    const startTime = Date.now();
    this.logger.info('Starting tabular data load', { bucket, key, tableName: options.tableName });

    // Step 1: Convert file to CSV format using TabularDataConverter
    try {
      this.logger.debug('Converting file to CSV format', { bucket, key });
      const convertResult = await this.converter.convert(bucket, key, 'csv');

      // Step 2: Read the converted CSV file
      const csvResult = await this.objectStore.read({
        bucket: convertResult.bucket,
        key: convertResult.key,
      });
      if (!isOk(csvResult)) {
        return Err(`Failed to read converted CSV: ${csvResult.error}`);
      }

      const csvContent = csvResult.value.toString('utf-8');
      if (!csvContent || csvContent.trim().length === 0) {
        return Err('CSV file is empty');
      }

      // Step 3: Parse CSV to extract schema and data
      this.logger.debug('Parsing CSV data', { csvSize: csvContent.length });
      const { schema, dataRows } = parseCsv(csvContent, (id) => this.sanitizeIdentifier(id));

      if (schema.length === 0) {
        return Err('No columns found in CSV data');
      }

      // Step 4: Sanitize table name
      const sanitizedTableName = this.sanitizeIdentifier(options.tableName);

      if (dataRows.length === 0) {
        this.logger.warn('No data rows found in CSV', { bucket, key });
        // Still create the table with schema
        const createResult = await this.createTable(sanitizedTableName, schema, options);
        if (!isOk(createResult)) {
          this.logger.error('Failed to create table for empty dataset', {
            error: createResult.error,
          });
          return Err(createResult.error);
        }
        return Ok({ tableName: sanitizedTableName, rowCount: 0 });
      }

      // Step 5: Create table
      const createResult = await this.createTable(sanitizedTableName, schema, options);
      if (!isOk(createResult)) {
        this.logger.error('Failed to create table', { error: createResult.error });
        return Err(createResult.error);
      }

      // Step 6: Load data using COPY FROM STDIN (fastest method)
      this.logger.debug('Loading data using COPY FROM STDIN', {
        tableName: sanitizedTableName,
        rowCount: dataRows.length,
      });
      const copyResult = await this.copyData(sanitizedTableName, schema, dataRows);

      if (!isOk(copyResult)) {
        this.logger.error('Failed to copy data', { error: copyResult.error });
        return Err(copyResult.error);
      }

      const rowCount = copyResult.value;
      const duration = Date.now() - startTime;
      this.logger.info('Tabular data load completed', {
        tableName: sanitizedTableName,
        rowCount,
        duration,
        rowsPerSecond: Math.round((rowCount / duration) * 1000),
      });

      return Ok({ tableName: sanitizedTableName, rowCount });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load tabular data', {
        bucket,
        key,
        tableName: options.tableName,
        error: errorMessage,
      });
      return Err(`Failed to load tabular data: ${errorMessage}`);
    }
  }

  /**
   * Sanitize identifier for SQL safety (table/column names)
   * Only allows alphanumeric characters and underscores, must start with letter or underscore
   */
  private sanitizeIdentifier(identifier: string): string {
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
   * Escape PostgreSQL identifier (table/column names)
   * Wraps in double quotes to handle special characters safely
   */
  private escapeIdentifier(identifier: string): string {
    // Replace any double quotes with escaped version and wrap in quotes
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Create PostgreSQL table with the given schema.
   * Returns Result<void, string>
   */
  private async createTable(
    tableName: string,
    schema: ColumnSchema[],
    options: LoadOptions,
  ): Promise<Result<void, string>> {
    // Drop table if requested
    if (options.dropIfExists) {
      this.logger.debug('Dropping table if exists', { tableName });
      const dropResult = await this.sql.unsafe(
        `DROP TABLE IF EXISTS ${this.escapeIdentifier(tableName)}`,
      );
      if (!isOk(dropResult)) {
        return Err(`Failed to drop table: ${dropResult.error}`);
      }
    }

    // Check if table exists
    const tableExistsQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
      ) as exists
    `;
    const tableExistsResult = await this.sql.query(
      tableExistsQuery,
      z.object({ exists: z.boolean() }),
      [tableName],
    );
    if (!isOk(tableExistsResult)) {
      return Err(`Failed to check if table exists: ${tableExistsResult.error}`);
    }
    const tableExists = tableExistsResult.value[0]?.exists ?? false;

    if (!tableExists) {
      // Create table with schema
      this.logger.debug('Creating table', { tableName, columnCount: schema.length });

      const columnDefinitions = schema
        .map((col) => {
          const typeMap: Record<ColumnSchema['type'], string> = {
            text: 'TEXT',
            integer: 'INTEGER',
            numeric: 'NUMERIC',
            boolean: 'BOOLEAN',
            date: 'DATE',
            timestamp: 'TIMESTAMP',
          };
          const pgType = typeMap[col.type];
          const nullable = col.nullable !== false ? '' : 'NOT NULL';
          return `${this.escapeIdentifier(col.name)} ${pgType} ${nullable}`.trim();
        })
        .join(', ');

      const createResult = await this.sql.unsafe(
        `CREATE TABLE ${this.escapeIdentifier(tableName)} (${columnDefinitions})`,
      );
      if (!isOk(createResult)) {
        return Err(`Failed to create table: ${createResult.error}`);
      }
    } else {
      this.logger.debug('Table already exists', { tableName });
    }

    // Truncate if requested
    if (options.truncate) {
      this.logger.debug('Truncating table', { tableName });
      const truncateResult = await this.sql.unsafe(
        `TRUNCATE TABLE ${this.escapeIdentifier(tableName)}`,
      );
      if (!isOk(truncateResult)) {
        return Err(`Failed to truncate table: ${truncateResult.error}`);
      }
    }
    return Ok(undefined);
  }

  /**
   * Load data using high-performance bulk insert with parameterized queries
   * Uses large batches for maximum performance (fewer round trips to database)
   * Returns Result<number, string>
   */
  private async copyData(
    tableName: string,
    schema: ColumnSchema[],
    dataRows: string[][],
  ): Promise<Result<number, string>> {
    if (dataRows.length === 0) {
      return Ok(0);
    }

    const escapedColumnNames = schema.map((col) => this.escapeIdentifier(col.name)).join(', ');

    // Use batched parameterized inserts for maximum performance
    // Batch size optimized for performance (larger batches = fewer round trips)
    const batchSize = 5000;
    let totalInserted = 0;

    // Use a transaction for better performance and atomicity
    const transactionResult = await this.sql.begin(async (tx) => {
      try {
        for (let i = 0; i < dataRows.length; i += batchSize) {
          const batch = dataRows.slice(i, i + batchSize);

          // Build parameterized query with VALUES clause
          // This is more performant than individual INSERTs and safer than string concatenation
          const placeholders: string[] = [];
          const values: (string | null)[] = [];

          batch.forEach((row) => {
            const rowPlaceholders: string[] = [];
            row.forEach((cell) => {
              const paramIndex = values.length + 1;
              rowPlaceholders.push(`$${paramIndex}`);
              // Convert empty strings to NULL, preserve other values
              values.push(cell === '' ? null : cell);
            });
            placeholders.push(`(${rowPlaceholders.join(', ')})`);
          });

          // Execute batched insert
          const insertQuery = `INSERT INTO ${this.escapeIdentifier(tableName)} (${escapedColumnNames}) VALUES ${placeholders.join(', ')}`;
          const insertResult = await tx.unsafe(insertQuery, values);
          if (!isOk(insertResult)) {
            return Err(`Failed to insert batch: ${insertResult.error}`);
          }

          totalInserted += batch.length;

          this.logger.debug('Inserted batch', {
            tableName,
            batchSize: batch.length,
            totalInserted,
            progress: `${Math.round((totalInserted / dataRows.length) * 100)}%`,
          });
        }
        // Return success result with total inserted count
        return Ok(totalInserted);
      } catch (e) {
        return Err(`Bulk insert transaction failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    });

    if (!isOk(transactionResult)) {
      return Err(`Transaction failed: ${transactionResult.error}`);
    }
    return transactionResult;
  }
}
