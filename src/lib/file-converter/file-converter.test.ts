import { beforeAll, describe, expect, test } from 'bun:test';
import type { S3Client } from 'bun';
import { createLogger } from '../logger';
import { createS3 } from '../../shared/s3';
import { createMinioClient } from '../minio/minio-client';
import { getS3Config } from '../../shared/s3-config';
import { FileConverter } from './file-converter';
import * as XLSX from 'xlsx';

describe('FileConverter', () => {
  const logger = createLogger();
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey } = getS3Config();
  const minioClient = createMinioClient({
    minioEndpoint: s3Endpoint,
    accessKey: s3AccessKeyId,
    secretKey: s3SecretAccessKey,
    logger,
  });
  const testBucket = 'test-file-converter';

  let s3Client: S3Client;
  let fileConverter: FileConverter;

  beforeAll(async () => {
    await minioClient.ensureBucketExists(testBucket);
    const s3 = await createS3({ logger });
    s3Client = s3.s3Client;
    fileConverter = new FileConverter({
      s3Client: s3.s3Client,
      logger,
      cacheBucket: testBucket,
    });
  });

  test('should generate deterministic cache keys', async () => {
    // Create a test Excel file
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([['Name'], ['John']]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const excelBuffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

    const sourceBucket = testBucket;
    const sourceKey = `test-cache-key-${Date.now()}.xlsx`;
    const targetFormat = 'csv' as const;

    // Upload file first
    await s3Client.file(sourceKey, { bucket: sourceBucket }).write(excelBuffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // First conversion - should create cache
    const result1 = await fileConverter.convert(sourceBucket, sourceKey, targetFormat);
    expect(result1.bucket).toBe(testBucket);
    expect(result1.key).toContain('file-conversions/');
    expect(result1.key).toContain('/csv.csv');

    // Second conversion - should return cached result
    const result2 = await fileConverter.convert(sourceBucket, sourceKey, targetFormat);
    expect(result2.key).toBe(result1.key); // Same cache key
  });

  test('should convert Excel to CSV', async () => {
    // Create a test Excel file
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      ['Name', 'Age', 'City'],
      ['John', 30, 'New York'],
      ['Jane', 25, 'London'],
    ]);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    const excelBuffer = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));

    // Upload Excel file to S3
    const sourceKey = `test-excel-${Date.now()}.xlsx`;
    await s3Client.file(sourceKey, { bucket: testBucket }).write(excelBuffer, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    // Convert to CSV
    const result = await fileConverter.convert(testBucket, sourceKey, 'csv');
    expect(result.bucket).toBe(testBucket);
    expect(result.key).toContain('.csv');

    // Verify CSV content
    const csvFile = s3Client.file(result.key, { bucket: result.bucket });
    expect(await csvFile.exists()).toBe(true);
    const csvContent = await csvFile.text();
    expect(csvContent).toContain('Name');
    expect(csvContent).toContain('John');
    expect(csvContent).toContain('Jane');
  });

  test('should convert CSV to Excel', async () => {
    // Create a test CSV file
    const csvContent = 'Name,Age,City\nJohn,30,New York\nJane,25,London';
    const csvBuffer = Buffer.from(csvContent, 'utf-8');

    // Upload CSV file to S3
    const sourceKey = `test-csv-${Date.now()}.csv`;
    await s3Client.file(sourceKey, { bucket: testBucket }).write(csvBuffer, {
      type: 'text/csv',
    });

    // Convert to Excel
    const result = await fileConverter.convert(testBucket, sourceKey, 'excel');
    expect(result.bucket).toBe(testBucket);
    expect(result.key).toContain('.xlsx');

    // Verify Excel file exists
    const excelFile = s3Client.file(result.key, { bucket: result.bucket });
    expect(await excelFile.exists()).toBe(true);

    // Read and verify Excel content
    const excelBuffer = Buffer.from(await excelFile.arrayBuffer());
    const workbook = XLSX.read(excelBuffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('Excel file has no sheets');
    }
    const firstSheet = workbook.Sheets[firstSheetName];
    if (!firstSheet) {
      throw new Error(`Sheet "${firstSheetName}" not found`);
    }
    const csvOutput = XLSX.utils.sheet_to_csv(firstSheet);
    expect(csvOutput).toContain('Name');
    expect(csvOutput).toContain('John');
    expect(csvOutput).toContain('Jane');
  });

  test('should handle cache hits efficiently', async () => {
    // Create a test file
    const csvContent = 'Name,Age\nJohn,30';
    const csvBuffer = Buffer.from(csvContent, 'utf-8');
    const sourceKey = `test-cache-${Date.now()}.csv`;
    await s3Client.file(sourceKey, { bucket: testBucket }).write(csvBuffer, {
      type: 'text/csv',
    });

    // First conversion
    const result1 = await fileConverter.convert(testBucket, sourceKey, 'excel');

    // Second conversion (should be cached)
    const result2 = await fileConverter.convert(testBucket, sourceKey, 'excel');

    // Should return same key
    expect(result1.key).toBe(result2.key);

    // Cached conversion should return the same result
    expect(result1.bucket).toBe(result2.bucket);
  });

  test('should handle same-format conversion (no-op)', async () => {
    const csvContent = 'Name,Age\nJohn,30';
    const csvBuffer = Buffer.from(csvContent, 'utf-8');
    const sourceKey = `test-same-format-${Date.now()}.csv`;
    await s3Client.file(sourceKey, { bucket: testBucket }).write(csvBuffer, {
      type: 'text/csv',
    });

    // Convert CSV to CSV (should still work, just returns cached version)
    const result = await fileConverter.convert(testBucket, sourceKey, 'csv');
    expect(result.key).toContain('.csv');

    // Verify content is preserved
    const cachedFile = s3Client.file(result.key, { bucket: result.bucket });
    const cachedContent = await cachedFile.text();
    expect(cachedContent).toContain('Name');
    expect(cachedContent).toContain('John');
  });

  test('should throw error for non-existent source file', async () => {
    const nonExistentKey = `non-existent-${Date.now()}.csv`;
    await expect(fileConverter.convert(testBucket, nonExistentKey, 'excel')).rejects.toThrow();
  });

  test('should handle different source buckets', async () => {
    // Create test file in testBucket
    const csvContent = 'Name,Age\nJohn,30';
    const csvBuffer = Buffer.from(csvContent, 'utf-8');
    const sourceKey = `test-bucket-${Date.now()}.csv`;
    await s3Client.file(sourceKey, { bucket: testBucket }).write(csvBuffer, {
      type: 'text/csv',
    });

    // Convert - should work with same bucket
    const result = await fileConverter.convert(testBucket, sourceKey, 'excel');
    expect(result.bucket).toBe(testBucket);
    expect(result.key).toContain('.xlsx');
  });
});
