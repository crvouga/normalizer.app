import type { S3Client } from 'bun';
import type { Logger } from '../logger';
import { FormatRegistry } from './format-registry';
import type { FileFormatHandler } from './file-format-handler';
import { ExcelHandler } from './handlers/excel-handler';
import { CsvHandler } from './handlers/csv-handler';
import { ParquetHandler } from './handlers/parquet-handler';

export interface ConvertResult {
  bucket: string;
  key: string;
}

export class FileConverter {
  private s3Client: S3Client;
  private logger: Logger;
  private cacheBucket: string;
  private registry: FormatRegistry;

  constructor({
    s3Client,
    logger,
    cacheBucket,
    customHandlers,
  }: {
    s3Client: S3Client;
    logger: Logger;
    cacheBucket?: string;
    customHandlers?: FileFormatHandler[];
  }) {
    this.s3Client = s3Client;
    this.logger = logger;
    // Use the default bucket from S3Client if cacheBucket not provided
    this.cacheBucket = cacheBucket || '';

    // Initialize registry with default handlers
    this.registry = new FormatRegistry();
    this.registerDefaultHandlers();

    // Register any custom handlers
    if (customHandlers) {
      for (const handler of customHandlers) {
        this.registry.register(handler);
      }
    }
  }

  /**
   * Register default file format handlers
   */
  private registerDefaultHandlers(): void {
    // Register handlers in order of specificity (more specific first)
    // Excel handler checks magic bytes, so register it first
    this.registry.register(new ExcelHandler());
    // Parquet handler checks magic bytes, so register it before CSV
    this.registry.register(new ParquetHandler());
    // CSV handler is more generic (extension-based), register last
    this.registry.register(new CsvHandler());
  }

  /**
   * Convert a file from S3 to the target format
   * Returns the bucket and key of the converted file (cached or newly created)
   */
  async convert(
    sourceBucket: string,
    sourceKey: string,
    targetFormat: string,
  ): Promise<ConvertResult> {
    this.logger.info('Starting file conversion', {
      sourceBucket,
      sourceKey,
      targetFormat,
    });

    // Validate target format
    if (!this.registry.hasFormat(targetFormat)) {
      const supportedFormats = this.registry.getAllFormats().join(', ');
      throw new Error(
        `Unsupported target format: ${targetFormat}. Supported formats: ${supportedFormats}`,
      );
    }

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

    // Detect source file type using registry
    const sourceFormat = this.detectFileType(sourceBuffer, sourceKey);

    // Perform conversion
    const convertedBuffer = await this.convertFile(sourceBuffer, sourceFormat, targetFormat);

    // Get handler for target format to get content type
    const targetHandler = this.registry.getHandler(targetFormat);
    if (!targetHandler) {
      throw new Error(`Handler not found for format: ${targetFormat}`);
    }
    const contentType = targetHandler.getContentType();

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
  private getCacheKey(sourceBucket: string, sourceKey: string, targetFormat: string): string {
    // Create a hash of sourceBucket:sourceKey for deterministic caching
    const hashInput = `${sourceBucket}:${sourceKey}`;
    const hash = Bun.hash(hashInput).toString(16);

    // Get handler for target format to get extension
    const handler = this.registry.getHandler(targetFormat);
    if (!handler) {
      throw new Error(`Handler not found for format: ${targetFormat}`);
    }
    const extension = handler.getExtension();

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
   * Detect file type from buffer and filename using registry
   */
  private detectFileType(buffer: Buffer, filename: string): string {
    const detectedFormat = this.registry.detectFormat(buffer, filename);
    if (!detectedFormat) {
      const supportedFormats = this.registry.getAllFormats().join(', ');
      throw new Error(`Unable to detect file type. Supported formats: ${supportedFormats}`);
    }
    return detectedFormat;
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
   * Convert file from source format to target format using handlers
   */
  private async convertFile(
    buffer: Buffer,
    sourceFormat: string,
    targetFormat: string,
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
      // Get handlers for source and target formats
      const sourceHandler = this.registry.getHandler(sourceFormat);
      const targetHandler = this.registry.getHandler(targetFormat);

      if (!sourceHandler) {
        throw new Error(`Handler not found for source format: ${sourceFormat}`);
      }
      if (!targetHandler) {
        throw new Error(`Handler not found for target format: ${targetFormat}`);
      }

      // Convert through CSV as intermediate format
      // Step 1: Convert source to CSV
      const csvData = await sourceHandler.toCsv(buffer);

      // Step 2: Convert CSV to target format
      return await targetHandler.fromCsv(csvData);
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
}
