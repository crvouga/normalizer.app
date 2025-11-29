import { Csv, type CsvColumnSchema } from '../csv/csv';
import type { Logger } from '../logger';
import type { ObjectStore } from '../object-store/object-store';
import { PostgresClient, type TableColumn } from '../postgres/postgres-client';
import { isOk, Ok, Err, type Result } from '../result';
import type { SqlDb } from '../sql-db/sql-db';
import { TabularDataConverter } from '../tabular-data-converter/tabular-data-converter';

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
 * Request for a single batch load operation
 */
export interface BatchLoadRequest {
  /**
   * Object store bucket name
   */
  bucket: string;
  /**
   * Object store key (file path)
   */
  key: string;
  /**
   * Loading options including table name
   */
  options: LoadOptions;
}

/**
 * Result for a single batch load operation
 */
export interface BatchLoadItemResult {
  /**
   * The original request
   */
  request: BatchLoadRequest;
  /**
   * Load result - success with table name and row count, or error message
   */
  result: Result<{ tableName: string; rowCount: number }, string>;
}

/**
 * Summary of batch load operation
 */
export interface BatchLoadSummary {
  /**
   * Total number of requests
   */
  total: number;
  /**
   * Number of successful loads
   */
  successful: number;
  /**
   * Number of failed loads
   */
  failed: number;
  /**
   * Total rows loaded across all successful loads
   */
  totalRowsLoaded: number;
  /**
   * Duration in milliseconds
   */
  duration: number;
}

/**
 * Result of batch load operation
 */
export interface BatchLoadResult {
  /**
   * Results for each individual load request
   */
  results: BatchLoadItemResult[];
  /**
   * Summary statistics
   */
  summary: BatchLoadSummary;
}

/**
 * High-performance PostgreSQL loader for tabular data from object storage.
 * Converts data to CSV format, creates tables dynamically, and uses COPY for bulk loading.
 */
export class TabularDataPostgresLoader {
  private converter: TabularDataConverter;
  private postgresClient: PostgresClient;

  constructor(
    sql: SqlDb,
    private readonly logger: Logger,
    private readonly objectStore: ObjectStore,
  ) {
    this.converter = new TabularDataConverter({
      objectStore,
      logger,
    });
    this.postgresClient = new PostgresClient(sql);
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
      const { schema, dataRows } = Csv.parse(csvContent, (id) => this.sanitizeIdentifier(id));

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
   * Load multiple tabular data files from object store into PostgreSQL tables in parallel.
   * All loads are processed concurrently, and each load is independent.
   * Failures in one load do not affect others.
   *
   * @param requests - Array of batch load requests, each specifying a file location and table options
   * @returns BatchLoadResult containing individual results and summary statistics
   */
  async loadBatch(requests: BatchLoadRequest[]): Promise<BatchLoadResult> {
    const startTime = Date.now();
    this.logger.info('Starting batch load', { requestCount: requests.length });

    if (requests.length === 0) {
      return {
        results: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          totalRowsLoaded: 0,
          duration: 0,
        },
      };
    }

    const loadPromises = requests.map((request) => this.loadSingleWithRequest(request));
    const settledResults = await Promise.allSettled(loadPromises);

    const results = this.buildBatchResults(requests, settledResults);
    const summary = this.buildBatchSummary(results, startTime);

    this.logger.info('Batch load completed', {
      total: summary.total,
      successful: summary.successful,
      failed: summary.failed,
      totalRowsLoaded: summary.totalRowsLoaded,
      duration: summary.duration,
    });

    return { results, summary };
  }

  /**
   * Load a single file with request context for batch operations
   */
  private async loadSingleWithRequest(
    request: BatchLoadRequest,
  ): Promise<Result<{ tableName: string; rowCount: number }, string>> {
    return this.load(request.bucket, request.key, request.options);
  }

  /**
   * Build batch results from settled promises
   */
  private buildBatchResults(
    requests: BatchLoadRequest[],
    settledResults: PromiseSettledResult<Result<{ tableName: string; rowCount: number }, string>>[],
  ): BatchLoadItemResult[] {
    return requests.map((request, index) => {
      const settled = settledResults[index];

      if (!settled) {
        return {
          request,
          result: Err('Promise result not available'),
        };
      }

      if (settled.status === 'fulfilled') {
        return {
          request,
          result: settled.value,
        };
      }

      const errorMessage =
        settled.reason instanceof Error ? settled.reason.message : String(settled.reason);
      return {
        request,
        result: Err(`Unexpected error: ${errorMessage}`),
      };
    });
  }

  /**
   * Build summary statistics from batch results
   */
  private buildBatchSummary(results: BatchLoadItemResult[], startTime: number): BatchLoadSummary {
    let successful = 0;
    let failed = 0;
    let totalRowsLoaded = 0;

    results.forEach((item) => {
      if (isOk(item.result)) {
        successful++;
        totalRowsLoaded += item.result.value.rowCount;
      } else {
        failed++;
      }
    });

    return {
      total: results.length,
      successful,
      failed,
      totalRowsLoaded,
      duration: Date.now() - startTime,
    };
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
   * Create PostgreSQL table with the given schema.
   * Returns Result<void, string>
   */
  private async createTable(
    tableName: string,
    schema: CsvColumnSchema[],
    options: LoadOptions,
  ): Promise<Result<void, string>> {
    // Drop table if requested
    if (options.dropIfExists) {
      this.logger.debug('Dropping table if exists', { tableName });
      const dropResult = await this.postgresClient.dropTable(tableName);
      if (!isOk(dropResult)) {
        return Err(`Failed to drop table: ${dropResult.error}`);
      }
    }

    // Check if table exists
    const tableExistsResult = await this.postgresClient.tableExists(tableName);
    if (!isOk(tableExistsResult)) {
      return Err(`Failed to check if table exists: ${tableExistsResult.error}`);
    }
    const tableExists = tableExistsResult.value;

    if (!tableExists) {
      // Create table with schema
      this.logger.debug('Creating table', { tableName, columnCount: schema.length });

      // Convert CsvColumnSchema[] to TableColumn[]
      const typeMap: Record<CsvColumnSchema['type'], TableColumn['type']> = {
        text: 'TEXT',
        integer: 'INTEGER',
        numeric: 'NUMERIC',
        boolean: 'BOOLEAN',
        date: 'DATE',
        timestamp: 'TIMESTAMP',
      };

      const tableColumns: TableColumn[] = schema.map((col) => {
        const column: TableColumn = {
          name: col.name,
          type: typeMap[col.type],
        };
        if (col.nullable !== undefined) {
          column.nullable = col.nullable;
        }
        return column;
      });

      const createResult = await this.postgresClient.createTable(tableName, tableColumns);
      if (!isOk(createResult)) {
        return Err(`Failed to create table: ${createResult.error}`);
      }
    } else {
      this.logger.debug('Table already exists', { tableName });
    }

    // Truncate if requested
    if (options.truncate) {
      this.logger.debug('Truncating table', { tableName });
      const truncateResult = await this.postgresClient.truncateTable(tableName);
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
    schema: CsvColumnSchema[],
    dataRows: string[][],
  ): Promise<Result<number, string>> {
    if (dataRows.length === 0) {
      return Ok(0);
    }

    const columnNames = schema.map((col) => col.name);
    const rows: (string | null)[][] = dataRows.map((row) =>
      row.map((cell) => (cell === '' ? null : cell)),
    );

    return this.postgresClient.insertBatch(tableName, columnNames, rows);
  }
}
