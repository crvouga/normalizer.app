import { Csv } from '../csv/csv';
import type { Logger } from '../logger';
import type { ObjectStore } from '../object-store/object-store';
import { combineUntilError, Err, isErr, isOk, Ok, type Result } from '../result';
import type { SqlDb } from '../sql-db/sql-db';
import { TabularDataConverter } from '../tabular-data-converter/tabular-data-converter';
import { type TabularFormat, getContentType, normalizeFormat } from '../tabular-data-format';
import { z } from 'zod';

/**
 * Request for a single export operation
 */
export interface ExportRequest {
  /**
   * SQL query to export
   * Must be a SELECT statement
   */
  query: string;
  /**
   * Target format for export
   * @default 'csv'
   */
  format?: TabularFormat;
  /**
   * Object store bucket name
   */
  bucket: string;
  /**
   * Object store key (file path)
   */
  key: string;
}

/**
 * Result for a single export operation
 */
export interface ExportItemResult {
  /**
   * The original request
   */
  request: ExportRequest;
  /**
   * Export result - success with row count and file size, or error message
   */
  result: Result<{ rowCount: number; fileSize: number }, string>;
}

/**
 * Summary of batch export operation
 */
export interface BatchExportSummary {
  /**
   * Total number of requests
   */
  total: number;
  /**
   * Number of successful exports
   */
  successful: number;
  /**
   * Number of failed exports
   */
  failed: number;
  /**
   * Total rows exported across all successful exports
   */
  totalRowsExported: number;
  /**
   * Total file size in bytes across all successful exports
   */
  totalFileSize: number;
  /**
   * Duration in milliseconds
   */
  duration: number;
}

/**
 * Result of batch export operation
 */
export interface BatchExportResult {
  /**
   * Combined result - success with array of results, or first error
   */
  result: Result<{ rowCount: number; fileSize: number }[], string>;
  /**
   * Results for each individual export request
   */
  results: ExportItemResult[];
  /**
   * Summary statistics
   */
  summary: BatchExportSummary;
}

/**
 * High-performance PostgreSQL exporter for tabular data to object storage.
 * Exports data from PostgreSQL tables or custom queries to various formats (CSV, XLSX, Parquet, JSON).
 */
export class TabularDataPostgresExporter {
  private converter: TabularDataConverter;
  private logger: Logger;
  private objectStore: ObjectStore;
  private db: SqlDb;

  constructor(sql: SqlDb, logger: Logger, objectStore: ObjectStore) {
    this.db = sql;
    this.objectStore = objectStore;
    this.logger = logger.child(TabularDataPostgresExporter.name);
    this.converter = new TabularDataConverter({
      objectStore: this.objectStore,
      logger: this.logger,
    });
  }

  /**
   * Export tabular data from PostgreSQL to object store.
   * This method uses streaming for maximum performance and memory efficiency:
   * 1. Queries data from PostgreSQL using the provided SQL query
   * 2. Converts results to CSV format
   * 3. If target format is not CSV, converts using TabularDataConverter
   * 4. Writes to object store
   *
   * @param request - Export request specifying query, format, and destination
   */
  async export(
    request: ExportRequest,
  ): Promise<Result<{ rowCount: number; fileSize: number }, string>> {
    const startTime = Date.now();
    const format = request.format || 'csv';

    // Validate request
    if (!request.bucket || request.bucket.trim() === '') {
      return Err('Failed to export tabular data: Bucket name is required');
    }

    try {
      this.logger.info('Starting tabular data export', {
        format,
        bucket: request.bucket,
        key: request.key,
      });

      // Step 1: Query data from PostgreSQL
      this.logger.debug('Exporting query');
      const queryResult = await this.queryCustomData(request.query);
      if (isErr(queryResult)) {
        return Err(`Failed to export tabular data: ${queryResult.error}`);
      }
      let csvData = queryResult.value.csvData;
      const rowCount = queryResult.value.rowCount;

      // Step 2: Convert to target format if not CSV
      let finalData: Buffer;
      let contentType: string;

      if (format === 'csv') {
        // For CSV, handle empty case
        if (rowCount === 0 && csvData.trim() === '') {
          csvData = '';
        }
        finalData = Buffer.from(csvData, 'utf-8');
        contentType = getContentType('csv');
      } else {
        // Handle empty result sets for JSON format
        if (csvData.trim() === '' && format === 'json') {
          // For JSON format, empty result set should be an empty array
          finalData = Buffer.from('[]', 'utf-8');
          contentType = getContentType('json');
        } else if (csvData.trim() === '') {
          // For other formats, ensure we have valid CSV data
          return Err(
            'Failed to export tabular data: Cannot export empty table to non-CSV format. Table must have at least column headers.',
          );
        } else {
          // Normal conversion path for non-empty data
          this.logger.debug('Converting CSV to target format', { format });
          // Normalize format name for converter (xlsx -> excel)
          const converterFormat = normalizeFormat(format);
          if (!converterFormat) {
            return Err(`Failed to export tabular data: Invalid format: ${format}`);
          }

          // Write CSV to temporary location for conversion
          const tempKey = `temp-export-${Date.now()}-${Math.random().toString(36).substring(7)}.csv`;
          const tempBucket = request.bucket;

          const writeResult = await this.objectStore.write({
            bucket: tempBucket,
            key: tempKey,
            data: Buffer.from(csvData, 'utf-8'),
            contentType: getContentType('csv'),
          });

          if (isErr(writeResult)) {
            return Err(
              `Failed to export tabular data: Failed to write temporary CSV: ${writeResult.error}`,
            );
          }

          try {
            // Convert using TabularDataConverter
            const convertResult = await this.converter.convert(
              tempBucket,
              tempKey,
              converterFormat,
            );
            const readResult = await this.objectStore.read({
              bucket: convertResult.bucket,
              key: convertResult.key,
            });

            if (isErr(readResult)) {
              return Err(
                `Failed to export tabular data: Failed to read converted file: ${readResult.error}`,
              );
            }

            finalData = readResult.value;

            // Determine content type based on format
            contentType = getContentType(format);

            // Clean up temporary CSV file
            await this.objectStore.delete({ bucket: tempBucket, key: tempKey });
          } catch (error) {
            // Clean up temporary file on error
            await this.objectStore.delete({ bucket: tempBucket, key: tempKey }).catch(() => {});
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            this.logger.error('Format conversion failed', {
              format,
              converterFormat,
              error: errorMessage,
              stack: errorStack,
            });
            return Err(`Failed to export tabular data: Failed to convert format: ${errorMessage}`);
          }
        }
      }

      // Step 3: Write to object store
      this.logger.debug('Writing exported file to object store', {
        bucket: request.bucket,
        key: request.key,
        size: finalData.length,
        format,
      });

      const writeResult = await this.objectStore.write({
        bucket: request.bucket,
        key: request.key,
        data: finalData,
        contentType,
      });

      if (isErr(writeResult)) {
        return Err(
          `Failed to export tabular data: Failed to write exported file: ${writeResult.error}`,
        );
      }

      const fileSize = finalData.length;
      const duration = Date.now() - startTime;
      this.logger.info('Tabular data export completed', {
        format,
        rowCount,
        fileSize,
        duration,
        rowsPerSecond: rowCount > 0 ? Math.round((rowCount / duration) * 1000) : 0,
      });

      return Ok({ rowCount, fileSize });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to export tabular data', {
        format,
        bucket: request.bucket,
        key: request.key,
        error: errorMessage,
      });
      return Err(`Failed to export tabular data: ${errorMessage}`);
    }
  }

  /**
   * Export multiple queries from PostgreSQL to object store in parallel.
   * All exports are processed concurrently, and each export is independent.
   * Failures in one export do not affect others.
   *
   * @param requests - Array of export requests, each specifying a query and destination
   * @returns BatchExportResult containing individual results and summary statistics
   */
  async exportBatch(requests: ExportRequest[]): Promise<BatchExportResult> {
    const startTime = Date.now();
    this.logger.info('Starting batch export', { requestCount: requests.length });

    if (requests.length === 0) {
      return {
        result: Ok([]),
        results: [],
        summary: {
          total: 0,
          successful: 0,
          failed: 0,
          totalRowsExported: 0,
          totalFileSize: 0,
          duration: 0,
        },
      };
    }

    const exportPromises = requests.map((request) => this.exportSingleWithRequest(request));
    const settledResults = await Promise.allSettled(exportPromises);

    const results = this.buildBatchResults(requests, settledResults);
    const summary = this.buildBatchSummary(results, startTime);

    this.logger.info('Batch export completed', {
      total: summary.total,
      successful: summary.successful,
      failed: summary.failed,
      totalRowsExported: summary.totalRowsExported,
      totalFileSize: summary.totalFileSize,
      duration: summary.duration,
    });

    const result = combineUntilError(results.map((itemResult) => itemResult.result));
    return { result, results, summary };
  }

  /**
   * Export a single request with request context for batch operations
   */
  private async exportSingleWithRequest(
    request: ExportRequest,
  ): Promise<Result<{ rowCount: number; fileSize: number }, string>> {
    return this.export(request);
  }

  /**
   * Build batch results from settled promises
   */
  private buildBatchResults(
    requests: ExportRequest[],
    settledResults: PromiseSettledResult<Result<{ rowCount: number; fileSize: number }, string>>[],
  ): ExportItemResult[] {
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
  private buildBatchSummary(results: ExportItemResult[], startTime: number): BatchExportSummary {
    let successful = 0;
    let failed = 0;
    let totalRowsExported = 0;
    let totalFileSize = 0;

    results.forEach((item) => {
      if (isOk(item.result)) {
        successful++;
        totalRowsExported += item.result.value.rowCount;
        totalFileSize += item.result.value.fileSize;
      } else {
        failed++;
      }
    });

    return {
      total: results.length,
      successful,
      failed,
      totalRowsExported,
      totalFileSize,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Query SQL and convert to CSV
   */
  private async queryCustomData(
    query: string,
  ): Promise<Result<{ csvData: string; rowCount: number }, string>> {
    // Validate query is a SELECT statement
    const trimmedQuery = query.trim();
    if (!trimmedQuery.toLowerCase().startsWith('select')) {
      return Err('Query must be a SELECT statement');
    }

    // Execute query
    const queryResult = await this.db.query(query, z.record(z.string(), z.unknown()));

    if (isErr(queryResult)) {
      return Err(`Failed to execute query: ${queryResult.error}`);
    }

    const rows = queryResult.value;
    const rowCount = rows.length;

    if (rowCount === 0) {
      // For empty result sets, return empty CSV
      // The export method will handle this appropriately (JSON gets empty array, others fail)
      return Ok({ csvData: '', rowCount: 0 });
    }

    // Extract column names from first row
    const columns = Object.keys(rows[0]!);

    // Convert to CSV
    const csvData = this.rowsToCsv(columns, rows);

    return Ok({ csvData, rowCount });
  }

  /**
   * Convert rows to CSV format
   */
  private rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
    if (rows.length === 0) {
      return columns.join(',');
    }

    // Build CSV using Csv.builder
    const csvRows = rows.map((row) => {
      const csvRow: Record<string, unknown> = {};
      for (const col of columns) {
        csvRow[col] = row[col] ?? null;
      }
      return csvRow;
    });

    return Csv.builder(csvRows).toString();
  }
}

export function createTabularDataPostgresExporter(params: {
  sql: SqlDb;
  logger: Logger;
  objectStore: ObjectStore;
}): TabularDataPostgresExporter {
  return new TabularDataPostgresExporter(params.sql, params.logger, params.objectStore);
}
