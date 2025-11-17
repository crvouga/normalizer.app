import type { S3Client } from 'bun';
import * as XLSX from 'xlsx';
// @ts-expect-error - parquetjs doesn't have types
import * as parquet from 'parquetjs';
import type { Logger } from '../logger';

export type FileFormat = 'excel' | 'csv' | 'parquet';

export interface ConvertResult {
  bucket: string;
  key: string;
}

export class FileConverter {
  private s3Client: S3Client;
  private logger: Logger;
  private cacheBucket: string;

  constructor({
    s3Client,
    logger,
    cacheBucket,
  }: {
    s3Client: S3Client;
    logger: Logger;
    cacheBucket?: string;
  }) {
    this.s3Client = s3Client;
    this.logger = logger;
    // Use the default bucket from S3Client if cacheBucket not provided
    this.cacheBucket = cacheBucket || '';
  }

  /**
   * Convert a file from S3 to the target format
   * Returns the bucket and key of the converted file (cached or newly created)
   */
  async convert(
    sourceBucket: string,
    sourceKey: string,
    targetFormat: FileFormat,
  ): Promise<ConvertResult> {
    this.logger.info('Starting file conversion', {
      sourceBucket,
      sourceKey,
      targetFormat,
    });

    // Generate cache key
    const cacheKey = this.getCacheKey(sourceBucket, sourceKey, targetFormat);
    const bucket = this.cacheBucket || sourceBucket;

    // Check cache first
    const cached = await this.checkCache(bucket, cacheKey);
    if (cached) {
      this.logger.info('Cache hit for file conversion', {
        bucket,
        cacheKey,
        sourceBucket,
        sourceKey,
        targetFormat,
      });
      return { bucket, key: cacheKey };
    }

    this.logger.info('Cache miss, performing conversion', {
      bucket,
      cacheKey,
      sourceBucket,
      sourceKey,
      targetFormat,
    });

    // Download source file
    const sourceBuffer = await this.downloadFile(sourceBucket, sourceKey);

    // Detect source file type
    const sourceFormat = this.detectFileType(sourceBuffer, sourceKey);

    // Perform conversion
    const convertedBuffer = await this.convertFile(sourceBuffer, sourceFormat, targetFormat);

    // Get content type for target format
    const contentType = this.getContentType(targetFormat);

    // Cache the converted file
    await this.uploadFile(bucket, cacheKey, convertedBuffer, contentType);

    this.logger.info('File conversion completed and cached', {
      bucket,
      cacheKey,
      sourceBucket,
      sourceKey,
      sourceFormat,
      targetFormat,
    });

    return { bucket, key: cacheKey };
  }

  /**
   * Generate a deterministic cache key based on source bucket, key, and target format
   */
  private getCacheKey(sourceBucket: string, sourceKey: string, targetFormat: FileFormat): string {
    // Create a hash of sourceBucket:sourceKey for deterministic caching
    const hashInput = `${sourceBucket}:${sourceKey}`;
    const hash = Bun.hash(hashInput).toString(16);
    const extension = this.getExtension(targetFormat);
    return `file-conversions/${hash}/${targetFormat}.${extension}`;
  }

  /**
   * Check if a cached conversion exists
   */
  private async checkCache(bucket: string, cacheKey: string): Promise<boolean> {
    try {
      const file = this.s3Client.file(cacheKey, { bucket });
      return await file.exists();
    } catch (error) {
      this.logger.warn('Error checking cache', {
        bucket,
        cacheKey,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Detect file type from buffer and filename
   */
  private detectFileType(buffer: Buffer, filename: string): FileFormat {
    // Check magic bytes first
    const magicBytes = buffer.subarray(0, Math.min(8, buffer.length));

    // Excel .xlsx files start with PK (ZIP signature)
    if (magicBytes[0] === 0x50 && magicBytes[1] === 0x4b) {
      // Could be xlsx or other zip-based formats, check extension
      const ext = filename.toLowerCase().split('.').pop();
      if (ext === 'xlsx' || ext === 'xlsm') {
        return 'excel';
      }
    }

    // Excel .xls files (OLE2 format)
    if (
      magicBytes[0] === 0xd0 &&
      magicBytes[1] === 0xcf &&
      magicBytes[2] === 0x11 &&
      magicBytes[3] === 0xe0
    ) {
      return 'excel';
    }

    // Parquet files start with PAR1
    if (
      magicBytes[0] === 0x50 &&
      magicBytes[1] === 0x41 &&
      magicBytes[2] === 0x52 &&
      magicBytes[3] === 0x31
    ) {
      return 'parquet';
    }

    // CSV detection - check extension and content
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'csv') {
      // Verify it looks like CSV by checking for comma or semicolon
      const text = buffer.toString('utf-8', 0, Math.min(1024, buffer.length));
      if (text.includes(',') || text.includes(';') || text.includes('\t')) {
        return 'csv';
      }
    }

    // Fallback to extension-based detection
    const normalizedExt = ext || '';
    if (normalizedExt === 'xlsx' || normalizedExt === 'xls' || normalizedExt === 'xlsm') {
      return 'excel';
    }
    if (normalizedExt === 'parquet') {
      return 'parquet';
    }
    if (normalizedExt === 'csv') {
      return 'csv';
    }

    throw new Error(
      `Unable to detect file type. Supported formats: excel (.xlsx, .xls), csv (.csv), parquet (.parquet)`,
    );
  }

  /**
   * Download a file from S3
   */
  private async downloadFile(bucket: string, key: string): Promise<Buffer> {
    try {
      const file = this.s3Client.file(key, { bucket });
      if (!(await file.exists())) {
        throw new Error(`File not found: ${bucket}/${key}`);
      }
      const arrayBuffer = await file.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      this.logger.error('Error downloading file from S3', {
        bucket,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Upload a file to S3
   */
  private async uploadFile(
    bucket: string,
    key: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<void> {
    try {
      await this.s3Client.file(key, { bucket }).write(buffer, {
        type: contentType,
      });
      this.logger.debug('File uploaded to S3', {
        bucket,
        key,
        size: buffer.length,
        contentType,
      });
    } catch (error) {
      this.logger.error('Error uploading file to S3', {
        bucket,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Convert file from source format to target format
   */
  private async convertFile(
    buffer: Buffer,
    sourceFormat: FileFormat,
    targetFormat: FileFormat,
  ): Promise<Buffer> {
    // If same format, return as-is
    if (sourceFormat === targetFormat) {
      return buffer;
    }

    this.logger.debug('Converting file', {
      sourceFormat,
      targetFormat,
    });

    try {
      // Convert through CSV as intermediate format for simplicity
      // This allows us to support all combinations: Excel ↔ CSV ↔ Parquet
      let csvData: string;

      // Step 1: Convert source to CSV
      if (sourceFormat === 'excel') {
        csvData = await this.excelToCsv(buffer);
      } else if (sourceFormat === 'parquet') {
        csvData = await this.parquetToCsv(buffer);
      } else {
        // Already CSV
        csvData = buffer.toString('utf-8');
      }

      // Step 2: Convert CSV to target format
      if (targetFormat === 'excel') {
        return await this.csvToExcel(csvData);
      } else if (targetFormat === 'parquet') {
        return await this.csvToParquet(csvData);
      } else {
        // Target is CSV
        return Buffer.from(csvData, 'utf-8');
      }
    } catch (error) {
      this.logger.error('Error converting file', {
        sourceFormat,
        targetFormat,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Failed to convert from ${sourceFormat} to ${targetFormat}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Convert Excel to CSV
   */
  private async excelToCsv(buffer: Buffer): Promise<string> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    // Use the first sheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('Excel file has no sheets');
    }
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      throw new Error(`Sheet "${firstSheetName}" not found in workbook`);
    }
    return XLSX.utils.sheet_to_csv(worksheet);
  }

  /**
   * Convert CSV to Excel
   */
  private async csvToExcel(csvData: string): Promise<Buffer> {
    const worksheet = XLSX.utils.aoa_to_sheet(
      csvData.split('\n').map((row) => {
        // Parse CSV row (simple comma split, doesn't handle quoted values perfectly)
        return row.split(',').map((cell) => cell.trim());
      }),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }

  /**
   * Convert Parquet to CSV
   */
  private async parquetToCsv(buffer: Buffer): Promise<string> {
    // Create a reader from buffer
    const reader = await parquet.ParquetReader.openBuffer(buffer);
    const cursor = reader.getCursor();
    const rows: string[][] = [];
    let headers: string[] | undefined;

    // Read all rows
    let row;
    while ((row = await cursor.next())) {
      if (!headers) {
        headers = Object.keys(row);
      }
      rows.push(Object.values(row) as string[]);
    }

    await reader.close();

    // Convert to CSV
    if (!headers || rows.length === 0) {
      return '';
    }

    const csvRows = [headers.join(',')];

    // Add data rows
    for (const row of rows) {
      csvRows.push(row.map((cell) => String(cell ?? '')).join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Convert CSV to Parquet
   */
  private async csvToParquet(csvData: string): Promise<Buffer> {
    const lines = csvData.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      throw new Error('CSV data is empty');
    }

    // Parse CSV (simple implementation - assumes no quoted commas)
    const rows = lines.map((line) => line.split(',').map((cell) => cell.trim()));

    if (rows.length === 0) {
      throw new Error('No data rows found');
    }

    const headers = rows[0];
    if (!headers || headers.length === 0) {
      throw new Error('No headers found in CSV');
    }

    const dataRows = rows.slice(1);

    // Create schema from headers (all fields as strings for simplicity)
    const schema = new parquet.ParquetSchema(
      Object.fromEntries(headers.map((header) => [header, { type: 'UTF8' }])),
    );

    // Write parquet file to buffer
    const writer = await parquet.ParquetWriter.openBuffer(schema);

    for (const row of dataRows) {
      const record: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (header) {
          record[header] = row[i] || '';
        }
      }
      await writer.appendRow(record);
    }

    await writer.close();
    return writer.getBuffer();
  }

  /**
   * Get file extension for a format
   */
  private getExtension(format: FileFormat): string {
    switch (format) {
      case 'excel':
        return 'xlsx';
      case 'csv':
        return 'csv';
      case 'parquet':
        return 'parquet';
    }
  }

  /**
   * Get content type for a format
   */
  private getContentType(format: FileFormat): string {
    switch (format) {
      case 'excel':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'csv':
        return 'text/csv';
      case 'parquet':
        return 'application/octet-stream';
    }
  }
}
