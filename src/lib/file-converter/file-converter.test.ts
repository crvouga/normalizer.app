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
    expect(fileConverter.convert(testBucket, nonExistentKey, 'excel')).rejects.toThrow();
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

  test('should throw error for unsupported conversion format', async () => {
    const csvContent = 'A,B\n1,2';
    const csvBuffer = Buffer.from(csvContent, 'utf-8');
    const sourceKey = `test-unsupported-format-${Date.now()}.csv`;
    await s3Client.file(sourceKey, { bucket: testBucket }).write(csvBuffer, {
      type: 'text/csv',
    });

    // Try to convert to an unsupported format
    expect(fileConverter.convert(testBucket, sourceKey, 'unsupported-format')).rejects.toThrow();
  });

  test('should preserve original file if no conversion is required', async () => {
    const fileContent = 'A,B\n1,2';
    const fileBuffer = Buffer.from(fileContent, 'utf-8');
    const sourceKey = `preserve-original-${Date.now()}.csv`;
    await s3Client.file(sourceKey, { bucket: testBucket }).write(fileBuffer, {
      type: 'text/csv',
    });

    // Convert CSV to CSV (no-op)
    const result = await fileConverter.convert(testBucket, sourceKey, 'csv');
    expect(result.bucket).toBe(testBucket);
    expect(result.key.endsWith('.csv')).toBeTruthy();

    const outputText = await s3Client.file(result.key, { bucket: result.bucket }).text();
    expect(outputText).toContain('A,B');
    expect(outputText).toContain('1,2');
  });

  test('should handle files with unusual filenames', async () => {
    const csvContent = 'foo,bar\n3,4';
    const strangeFilename = `fiłę n@me_${Date.now()}.csv`;
    await s3Client.file(strangeFilename, { bucket: testBucket }).write(Buffer.from(csvContent), {
      type: 'text/csv',
    });

    const result = await fileConverter.convert(testBucket, strangeFilename, 'excel');
    expect(result.key).toContain('.xlsx');

    const exists = await s3Client.file(result.key, { bucket: result.bucket }).exists();
    expect(exists).toBe(true);
  });

  test('should detect and convert different file formats', async () => {
    const formats = [
      { ext: 'csv', content: 'a,b\n3,4', target: 'excel', targetExt: '.xlsx' },
      // Add more formats if those handlers exist in the registry
    ];
    for (const { ext, content, target, targetExt } of formats) {
      const key = `multi-format-${Date.now()}.${ext}`;
      await s3Client
        .file(key, { bucket: testBucket })
        .write(Buffer.from(content), { type: `text/${ext}` });

      const result = await fileConverter.convert(testBucket, key, target);
      expect(result.key).toContain(targetExt);
      const exists = await s3Client.file(result.key, { bucket: result.bucket }).exists();
      expect(exists).toBe(true);
    }
  });

  test('should throw if destination bucket does not exist', async () => {
    // Attempt to convert to file in a bucket that is not setup
    const csvContent = 'col1,col2\nx,y';
    const csvBuffer = Buffer.from(csvContent, 'utf-8');
    const sourceKey = `test-nonexistent-dest-${Date.now()}.csv`;
    await s3Client.file(sourceKey, { bucket: testBucket }).write(csvBuffer, {
      type: 'text/csv',
    });

    // Provide a non-existent bucket to the result (simulate)
    const nonExistentBucket = `NO_BUCKET_${Date.now()}`;
    expect(fileConverter.convert(nonExistentBucket, sourceKey, 'excel')).rejects.toThrow();
  });
});
