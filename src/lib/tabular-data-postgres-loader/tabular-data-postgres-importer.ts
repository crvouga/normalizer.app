import { Csv, type CsvColumnSchema } from '../csv/csv';
import type { Logger } from '../logger';
import type { ObjectStore } from '../object-store/object-store';
import { PostgresClient, type TableColumn } from '../postgres/postgres-client';
import { combineUntilError, Err, isErr, isOk, Ok, type Result } from '../result';
import type { SqlDb } from '../sql-db/sql-db';
import { TabularDataConverter } from '../tabular-data-converter/tabular-data-converter';

/**
 * Options for importing tabular data into PostgreSQL
 */
export interface ImportOptions {
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
   * Whether to truncate the table before importing
   * @default false
   */
  truncate?: boolean;
}

/**
 * Request for a single batch import operation
 */
export interface BatchImportRequest {
  /**
   * Object store bucket name
   */
  bucket: string;
  /**
   * Object store key (file path)
   */
  key: string;
  /**
   * Importing options including table name
   */
  options: ImportOptions;
}

/**
 * Result for a single batch import operation
 */
export interface BatchImportItemResult {
  /**
   * The original request
   */
  request: BatchImportRequest;
  /**
   * Import result - success with table name and row count, or error message
   */
  result: Result<{ tableName: string; rowCount: number }, string>;
}

/**
 * Summary of batch import operation
 */
export interface BatchImportSummary {
  /**
   * Total number of requests
   */
  total: number;
  /**
   * Number of successful imports
   */
  successful: number;
  /**
   * Number of failed imports
   */
  failed: number;
  /**
   * Total rows imported across all successful imports
   */
  totalRowsImported: number;
  /**
   * Duration in milliseconds
   */
  duration: number;
}

/**
 * Result of batch import operation
 */
export interface BatchImportResult {
  /**
   *
   */
  result: Result<{ tableName: string; rowCount: number }[], string>;
  /**
   * Results for each individual import request
   */
  results: BatchImportItemResult[];
  /**
   * Summary statistics
   */
  summary: BatchImportSummary;
}

/**
 * High-performance PostgreSQL importer for tabular data from object storage.
 * Converts data to CSV format, creates tables dynamically, and uses COPY for bulk importing.
 */
export class TabularDataPostgresImporter {
  private converter: TabularDataConverter;
  private postgresClient: PostgresClient;
  private logger: Logger;
  private objectStore: ObjectStore;

  constructor(sql: SqlDb, logger: Logger, objectStore: ObjectStore) {
    this.objectStore = objectStore;
    this.logger = logger.child(TabularDataPostgresImporter.name);
    this.converter = new TabularDataConverter({
      objectStore: this.objectStore,
      logger: this.logger,
    });
    this.postgresClient = new PostgresClient(sql);
  }

  /**
   * Import tabular data from object store into PostgreSQL table.
   * This method:
   * 1. Converts the file to CSV format using TabularDataConverter
   * 2. Parses CSV to extract schema and data
   * 3. Creates the table dynamically
   * 4. Uses COPY FROM STDIN for maximum performance
   *
   * @param bucket - Object store bucket name
   * @param key - Object store key (file path)
   * @param options - Importing options including table name
   */
  async import(
    bucket: string,
    key: string,
    options: ImportOptions,
  ): Promise<Result<{ tableName: string; rowCount: number }, string>> {
    const startTime = Date.now();
    this.logger.info('Starting tabular data import', { bucket, key, tableName: options.tableName });

    // Step 1: Convert file to CSV format using TabularDataConverter
    try {
      this.logger.debug('Converting file to CSV format', { bucket, key });
      const convertResult = await this.converter.convert(bucket, key, 'csv');

      // Step 2: Read the converted CSV file
      const csvResult = await this.objectStore.read({
        bucket: convertResult.bucket,
        key: convertResult.key,
      });
      if (isErr(csvResult)) {
        return Err(`Failed to read converted CSV: ${csvResult.error}`);
      }

      const csvContent = csvResult.value.toString('utf-8');
      if (!csvContent || csvContent.trim().length === 0) {
        return Err('CSV file is empty');
      }

      // Step 3: Parse CSV headers and lines in a single pass (no schema inference needed)
      // All columns will be TEXT type, so we only need the header names
      this.logger.debug('Parsing CSV headers', { csvSize: csvContent.length });
      const { headers, lines, dataRowCount } = Csv.parseHeaders(csvContent);

      if (headers.length === 0) {
        return Err('No columns found in CSV data');
      }

      const sanitizedHeaders = headers.map((name) => PostgresClient.sanitizeIdentifier(name));

      // Step 4: Sanitize table name
      const sanitizedTableName = PostgresClient.sanitizeIdentifier(options.tableName);

      // Generate schema with all TEXT columns (no type inference needed)
      const schema: CsvColumnSchema[] = sanitizedHeaders.map((name) => ({
        name,
        type: 'text',
        nullable: true,
      }));

      // Step 5: Create table
      const createResult = await this.createTable(sanitizedTableName, schema, options);
      if (isErr(createResult)) {
        this.logger.error('Failed to create table', { error: createResult.error });
        return Err(createResult.error);
      }

      if (dataRowCount === 0) {
        this.logger.warn('No data rows found in CSV', { bucket, key });
        return Ok({ tableName: sanitizedTableName, rowCount: 0 });
      }

      // Step 6: Import data using optimized batch streaming
      const insertResult = await this.insertCsvDataInBatches(
        sanitizedTableName,
        sanitizedHeaders,
        lines,
        dataRowCount,
      );

      if (isErr(insertResult)) {
        return Err(insertResult.error);
      }

      const rowCount = insertResult.value;
      const duration = Date.now() - startTime;
      this.logger.info('Tabular data import completed', {
        tableName: sanitizedTableName,
        rowCount,
        duration,
        rowsPerSecond: Math.round((rowCount / duration) * 1000),
      });

      return Ok({ tableName: sanitizedTableName, rowCount });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to import tabular data', {
        bucket,
        key,
        tableName: options.tableName,
        error: errorMessage,
      });
      return Err(`Failed to import tabular data: ${errorMessage}`);
    }
  }

  /**
   * Import multiple tabular data files from object store into PostgreSQL tables in parallel.
   * All imports are processed concurrently, and each import is independent.
   * Failures in one import do not affect others.
   *
   * @param requests - Array of batch import requests, each specifying a file location and table options
   * @returns BatchImportResult containing individual results and summary statistics
   */
  async importBatch(requests: BatchImportRequest[]): Promise<BatchImportResult> {
    const startTime = Date.now();
    this.logger.info('Starting batch import', { requestCount: requests.length });

    if (requests.length === 0) {
      return {
        result: Ok([]),
        results: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          totalRowsImported: 0,
          duration: 0,
        },
      };
    }

    const importPromises = requests.map((request) => this.importSingleWithRequest(request));
    const settledResults = await Promise.allSettled(importPromises);

    const results = this.buildBatchResults(requests, settledResults);
    const summary = this.buildBatchSummary(results, startTime);

    this.logger.info('Batch import completed', {
      total: summary.total,
      successful: summary.successful,
      failed: summary.failed,
      totalRowsImported: summary.totalRowsImported,
      duration: summary.duration,
    });

    const result = combineUntilError(results.map((itemResult) => itemResult.result));
    return { result, results, summary };
  }

  /**
   * Import a single file with request context for batch operations
   */
  private async importSingleWithRequest(
    request: BatchImportRequest,
  ): Promise<Result<{ tableName: string; rowCount: number }, string>> {
    return this.import(request.bucket, request.key, request.options);
  }

  /**
   * Build batch results from settled promises
   */
  private buildBatchResults(
    requests: BatchImportRequest[],
    settledResults: PromiseSettledResult<Result<{ tableName: string; rowCount: number }, string>>[],
  ): BatchImportItemResult[] {
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
  private buildBatchSummary(
    results: BatchImportItemResult[],
    startTime: number,
  ): BatchImportSummary {
    let successful = 0;
    let failed = 0;
    let totalRowsImported = 0;

    results.forEach((item) => {
      if (isOk(item.result)) {
        successful++;
        totalRowsImported += item.result.value.rowCount;
      } else {
        failed++;
      }
    });

    return {
      total: results.length,
      successful,
      failed,
      totalRowsImported,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Create PostgreSQL table with the given schema.
   * All columns are created as TEXT type for simplicity.
   * Returns Result<void, string>
   */
  private async createTable(
    tableName: string,
    schema: CsvColumnSchema[],
    options: ImportOptions,
  ): Promise<Result<void, string>> {
    // Drop table if requested
    if (options.dropIfExists) {
      this.logger.debug('Dropping table if exists', { tableName });
      const dropResult = await this.postgresClient.dropTable(tableName);
      if (isErr(dropResult)) {
        return Err(`Failed to drop table: ${dropResult.error}`);
      }
    }

    // Check if table exists
    const tableExistsResult = await this.postgresClient.tableExists(tableName);
    if (isErr(tableExistsResult)) {
      return Err(`Failed to check if table exists: ${tableExistsResult.error}`);
    }
    const tableExists = tableExistsResult.value;

    if (!tableExists) {
      // Create table with schema
      this.logger.debug('Creating table', { tableName, columnCount: schema.length });

      // Convert CsvColumnSchema[] to TableColumn[]
      // All columns are TEXT type
      const tableColumns: TableColumn[] = schema.map((col) => {
        const column: TableColumn = {
          name: col.name,
          type: 'TEXT',
        };
        if (col.nullable !== undefined) {
          column.nullable = col.nullable;
        }
        return column;
      });

      const createResult = await this.postgresClient.createTable(tableName, tableColumns);
      if (isErr(createResult)) {
        return Err(`Failed to create table: ${createResult.error}`);
      }
    } else {
      this.logger.debug('Table already exists', { tableName });
    }

    // Truncate if requested
    if (options.truncate) {
      this.logger.debug('Truncating table', { tableName });
      const truncateResult = await this.postgresClient.truncateTable(tableName);
      if (isErr(truncateResult)) {
        return Err(`Failed to truncate table: ${truncateResult.error}`);
      }
    }
    return Ok(undefined);
  }

  /**
   * Import CSV data using optimized batch streaming.
   * Processes data in batches to avoid loading all rows into memory.
   * @param tableName - Sanitized table name
   * @param headers - Array of column names
   * @param lines - Array of CSV lines (header at index 0, data rows start at index 1)
   * @param estimatedRowCount - Estimated number of data rows (for logging)
   * @returns Result containing the total number of rows inserted, or an error
   */
  private async insertCsvDataInBatches(
    tableName: string,
    columnNames: string[],
    lines: string[],
    estimatedRowCount: number,
  ): Promise<Result<number, string>> {
    this.logger.debug('Importing CSV data in batches', {
      tableName,
      estimatedRowCount,
    });

    const BATCH_SIZE = 5000;
    let totalInserted = 0;

    // Process data rows in batches (skip header at index 0)
    for (let i = 1; i < lines.length; i += BATCH_SIZE) {
      const batchEnd = Math.min(i + BATCH_SIZE, lines.length);
      const batchLines = lines.slice(i, batchEnd);

      // Parse only the current batch
      const rows: (string | null)[][] = [];
      for (const line of batchLines) {
        const values = Csv.parseLine(line);
        // Pad or truncate row to match header length
        while (values.length < columnNames.length) {
          values.push('');
        }
        // Convert empty strings to null during parsing (not after)
        const row = values.slice(0, columnNames.length).map((cell) => (cell === '' ? null : cell));
        rows.push(row);
      }

      // Insert current batch
      const insertResult = await this.postgresClient.insertBatch(tableName, columnNames, rows);

      if (isErr(insertResult)) {
        this.logger.error('Failed to insert data batch', {
          error: insertResult.error,
          batchStart: i,
          batchEnd,
        });
        return Err(insertResult.error);
      }

      totalInserted += insertResult.value;
    }

    return Ok(totalInserted);
  }
}

export function createTabularDataPostgresImporter(params: {
  sql: SqlDb;
  logger: Logger;
  objectStore: ObjectStore;
}): TabularDataPostgresImporter {
  return new TabularDataPostgresImporter(params.sql, params.logger, params.objectStore);
}
