import type postgres from 'postgres';
import type { ObjectStore } from '../object-store/object-store';
import type { Logger } from '../logger';
import { TabularDataConverter } from '../tabular-data-converter/tabular-data-converter';
import { isOk } from '../result';
import { parseCsv, type ColumnSchema } from '../csv/csv';

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
    private readonly sql: ReturnType<typeof postgres>,
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
  ): Promise<{ tableName: string; rowCount: number }> {
    const startTime = Date.now();
    this.logger.info('Starting tabular data load', { bucket, key, tableName: options.tableName });

    try {
      // Step 1: Convert file to CSV format using TabularDataConverter
      this.logger.debug('Converting file to CSV format', { bucket, key });
      const convertResult = await this.converter.convert(bucket, key, 'csv');

      // Step 2: Read the converted CSV file
      const csvResult = await this.objectStore.read({
        bucket: convertResult.bucket,
        key: convertResult.key,
      });
      if (!isOk(csvResult)) {
        throw new Error(`Failed to read converted CSV: ${csvResult.error}`);
      }

      const csvContent = csvResult.value.toString('utf-8');
      if (!csvContent || csvContent.trim().length === 0) {
        throw new Error('CSV file is empty');
      }

      // Step 3: Parse CSV to extract schema and data
      this.logger.debug('Parsing CSV data', { csvSize: csvContent.length });
      const { schema, dataRows } = parseCsv(csvContent, (id) => this.sanitizeIdentifier(id));

      if (schema.length === 0) {
        throw new Error('No columns found in CSV data');
      }

      if (dataRows.length === 0) {
        this.logger.warn('No data rows found in CSV', { bucket, key });
        // Still create the table with schema
        const sanitizedTableName = this.sanitizeIdentifier(options.tableName);
        await this.createTable(sanitizedTableName, schema, options);
        return { tableName: sanitizedTableName, rowCount: 0 };
      }

      // Step 4: Sanitize table name
      const sanitizedTableName = this.sanitizeIdentifier(options.tableName);

      // Step 5: Create table
      await this.createTable(sanitizedTableName, schema, options);

      // Step 6: Load data using COPY FROM STDIN (fastest method)
      this.logger.debug('Loading data using COPY FROM STDIN', {
        tableName: sanitizedTableName,
        rowCount: dataRows.length,
      });
      const rowCount = await this.copyData(sanitizedTableName, schema, dataRows);

      const duration = Date.now() - startTime;
      this.logger.info('Tabular data load completed', {
        tableName: sanitizedTableName,
        rowCount,
        duration,
        rowsPerSecond: Math.round((rowCount / duration) * 1000),
      });

      return { tableName: sanitizedTableName, rowCount };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to load tabular data', {
        bucket,
        key,
        tableName: options.tableName,
        error: errorMessage,
      });
      throw new Error(`Failed to load tabular data: ${errorMessage}`);
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
   * Create PostgreSQL table with the given schema
   */
  private async createTable(
    tableName: string,
    schema: ColumnSchema[],
    options: LoadOptions,
  ): Promise<void> {
    // Drop table if requested
    if (options.dropIfExists) {
      this.logger.debug('Dropping table if exists', { tableName });
      await this.sql.unsafe(`DROP TABLE IF EXISTS ${this.escapeIdentifier(tableName)}`);
    }

    // Check if table exists
    const tableExistsResult = await this.sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      )
    `;
    const tableExists = tableExistsResult[0]?.exists ?? false;

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

      await this.sql.unsafe(
        `CREATE TABLE ${this.escapeIdentifier(tableName)} (${columnDefinitions})`,
      );
    } else {
      this.logger.debug('Table already exists', { tableName });
    }

    // Truncate if requested
    if (options.truncate) {
      this.logger.debug('Truncating table', { tableName });
      await this.sql.unsafe(`TRUNCATE TABLE ${this.escapeIdentifier(tableName)}`);
    }
  }

  /**
   * Load data using high-performance bulk insert with parameterized queries
   * Uses large batches for maximum performance (fewer round trips to database)
   */
  private async copyData(
    tableName: string,
    schema: ColumnSchema[],
    dataRows: string[][],
  ): Promise<number> {
    if (dataRows.length === 0) {
      return 0;
    }

    const escapedColumnNames = schema.map((col) => this.escapeIdentifier(col.name)).join(', ');

    // Use batched parameterized inserts for maximum performance
    // Batch size optimized for performance (larger batches = fewer round trips)
    const batchSize = 5000;
    let totalInserted = 0;

    // Use a transaction for better performance and atomicity
    await this.sql.begin(async (tx) => {
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
        await tx.unsafe(insertQuery, values);

        totalInserted += batch.length;

        this.logger.debug('Inserted batch', {
          tableName,
          batchSize: batch.length,
          totalInserted,
          progress: `${Math.round((totalInserted / dataRows.length) * 100)}%`,
        });
      }
    });

    return totalInserted;
  }
}
