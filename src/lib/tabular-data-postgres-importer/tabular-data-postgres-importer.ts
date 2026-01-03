import { Csv, type CsvColumnSchema } from '../csv/csv';
import type { Logger } from '../logger';
import type { ObjectStore } from '../object-store/object-store';
import {
  createPostgresClient,
  PostgresClient,
  type TableColumn,
} from '../postgres/postgres-client';
import { combineUntilError, Err, isErr, isOk, Ok, type Result } from '../result';
import type { SqlDb } from '../sql-db/sql-db';
import { TabularDataConverter } from '../tabular-data-converter/tabular-data-converter';

/**
 * Request for a single batch import operation
 */
export interface ImportRequest {
  /**
   * Object store bucket name
   */
  bucket: string;
  /**
   * Object store key (file path)
   */
  key: string;
  /**
   * View name to create/use (will be sanitized)
   */
  viewName: string;
  /**
   * Whether to drop the view if it already exists
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
 * Result for a single batch import operation
 */
export interface BatchImportItemResult {
  /**
   * The original request
   */
  request: ImportRequest;
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
    this.postgresClient = createPostgresClient({ db: sql, logger });
  }

  /**
   * Import tabular data from object store into PostgreSQL table.
   * This method uses streaming for maximum performance and memory efficiency:
   * 1. Converts the file to CSV format using TabularDataConverter
   * 2. Streams CSV data and parses headers
   * 3. Creates the table dynamically
   * 4. Uses COPY FROM STDIN (or optimized batch insert) for maximum performance
   *
   * @param bucket - Object store bucket name
   * @param key - Object store key (file path)
   * @param options - Importing options including table name
   */
  async import({
    bucket,
    key,
    viewName,
    dropIfExists,
    truncate,
  }: {
    viewName: string;
    dropIfExists?: boolean;
    truncate?: boolean;
    bucket: string;
    key: string;
  }): Promise<Result<{ tableName: string; rowCount: number }, string>> {
    const startTime = Date.now();
    this.logger.info('Starting tabular data import', { bucket, key, tableName: viewName });

    // Step 1: Convert file to CSV format using TabularDataConverter
    try {
      this.logger.debug('Converting file to CSV format', { bucket, key });
      const convertResult = await this.converter.convert(bucket, key, 'csv');

      // Step 2: Read the converted CSV file as a stream
      this.logger.debug('Reading CSV file as stream', {
        bucket: convertResult.bucket,
        key: convertResult.key,
      });
      const csvStreamResult = await this.objectStore.readStream({
        bucket: convertResult.bucket,
        key: convertResult.key,
      });
      if (isErr(csvStreamResult)) {
        return Err(`Failed to read converted CSV stream: ${csvStreamResult.error}`);
      }

      // Step 3: Parse CSV headers and create streaming row generator
      this.logger.debug('Parsing CSV stream', {
        bucket: convertResult.bucket,
        key: convertResult.key,
      });
      const { headers, rowStream } = await Csv.parseStreaming(csvStreamResult.value);

      if (headers.length === 0) {
        return Err('No columns found in CSV data');
      }

      const sanitizedHeaders = this.makeHeadersUnique(
        headers.map((name) => PostgresClient.sanitizeIdentifier(name)),
      );

      // Step 4: Sanitize table name
      const sanitizedTableName = PostgresClient.sanitizeIdentifier(viewName);

      // Generate schema with all TEXT columns (no type inference needed)
      const schema: CsvColumnSchema[] = sanitizedHeaders.map((name) => ({
        name,
        type: 'text',
        nullable: true,
      }));

      // Step 5: Create table
      const createResult = await this.createTable({
        tableName: sanitizedTableName,
        schema,
        dropIfExists: dropIfExists ?? false,
        truncate: truncate ?? false,
      });
      if (isErr(createResult)) {
        this.logger.error('Failed to create table', { error: createResult.error });
        return Err(createResult.error);
      }

      // Step 6: Convert row stream to format expected by copyFromStream
      // The rowStream yields string arrays, we need to convert empty strings to null
      async function* convertRowStream(
        source: AsyncGenerator<string[], void, unknown>,
      ): AsyncGenerator<(string | null)[], void, unknown> {
        for await (const row of source) {
          yield row.map((cell) => (cell === '' ? null : cell));
        }
      }

      // Step 7: Import data using COPY FROM STDIN (or optimized batch insert)
      this.logger.debug('Importing data using streaming COPY', {
        tableName: sanitizedTableName,
        columnCount: sanitizedHeaders.length,
      });
      const insertResult = await this.postgresClient.copyFromStream(
        sanitizedTableName,
        sanitizedHeaders,
        convertRowStream(rowStream),
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
        rowsPerSecond: rowCount > 0 ? Math.round((rowCount / duration) * 1000) : 0,
      });

      return Ok({ tableName: sanitizedTableName, rowCount });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to import tabular data', {
        bucket,
        key,
        tableName: viewName,
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
  async importBatch(requests: ImportRequest[]): Promise<BatchImportResult> {
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
    request: ImportRequest,
  ): Promise<Result<{ tableName: string; rowCount: number }, string>> {
    const options: { viewName: string; dropIfExists?: boolean; truncate?: boolean } = {
      viewName: request.viewName,
    };
    if (request.dropIfExists !== undefined) {
      options.dropIfExists = request.dropIfExists;
    }
    if (request.truncate !== undefined) {
      options.truncate = request.truncate;
    }
    return this.import({
      bucket: request.bucket,
      key: request.key,
      viewName: request.viewName,
      dropIfExists: request.dropIfExists ?? false,
      truncate: request.truncate ?? false,
    });
  }

  /**
   * Build batch results from settled promises
   */
  private buildBatchResults(
    requests: ImportRequest[],
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
   * Make headers unique by appending numeric suffixes to duplicates.
   * For example: ['_unnamed', '_unnamed', 'col1'] becomes ['_unnamed', '_unnamed_2', 'col1']
   */
  private makeHeadersUnique(headers: string[]): string[] {
    const seen = new Map<string, number>();
    const result: string[] = [];

    for (const header of headers) {
      if (!seen.has(header)) {
        // First occurrence - use as-is
        seen.set(header, 1);
        result.push(header);
      } else {
        // Duplicate - append suffix
        const count = seen.get(header)! + 1;
        seen.set(header, count);
        const uniqueName = `${header}_${count}`;
        result.push(uniqueName);
      }
    }

    return result;
  }

  /**
   * Create PostgreSQL table with the given schema.
   * All columns are created as TEXT type for simplicity.
   * Returns Result<void, string>
   */
  private async createTable({
    dropIfExists,
    truncate,
    tableName,
    schema,
  }: {
    dropIfExists?: boolean;
    truncate?: boolean;
    tableName: string;
    schema: CsvColumnSchema[];
  }): Promise<Result<void, string>> {
    // Drop table if requested
    if (dropIfExists) {
      this.logger.debug('Dropping table if exists', { tableName });
      const dropResult = await this.postgresClient.dropTable(tableName);
      if (isErr(dropResult)) {
        return Err(`Failed to drop table: ${dropResult.error}`);
      }
    }

    // Check if table exists
    const tableExistsResult = await this.postgresClient.viewExist(tableName);
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
    if (truncate) {
      this.logger.debug('Truncating table', { tableName });
      const truncateResult = await this.postgresClient.truncateTable(tableName);
      if (isErr(truncateResult)) {
        return Err(`Failed to truncate table: ${truncateResult.error}`);
      }
    }
    return Ok(undefined);
  }
}

export function createTabularDataPostgresImporter(params: {
  sql: SqlDb;
  logger: Logger;
  objectStore: ObjectStore;
}): TabularDataPostgresImporter {
  return new TabularDataPostgresImporter(params.sql, params.logger, params.objectStore);
}
