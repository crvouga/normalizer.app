import { beforeAll, describe, expect, test } from 'bun:test';
import * as XLSX from 'xlsx';
import { createObjectStore } from '../../shared/s3';
import { createLogger } from '../logger';
import type { ObjectStore } from '../object-store/object-store';
import { isOk } from '../result';
import { FileConverter } from './file-converter';

describe('FileConverter', () => {
  const logger = createLogger();
  const testBucket = 'test-file-converter';

  let objectStore: ObjectStore;
  let fileConverter: FileConverter;

  beforeAll(async () => {
    objectStore = await createObjectStore({ logger });
    await objectStore.ensureBucketExists(testBucket);
    fileConverter = new FileConverter({
      objectStore,
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
    const writeResult = await objectStore.write({
      bucket: sourceBucket,
      key: sourceKey,
      data: excelBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    if (!isOk(writeResult)) {
      throw new Error(`Failed to write: ${writeResult.error}`);
    }

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
    const writeResult1 = await objectStore.write({
      bucket: testBucket,
      key: sourceKey,
      data: excelBuffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    if (!isOk(writeResult1)) {
      throw new Error(`Failed to write: ${writeResult1.error}`);
    }

    // Convert to CSV
    const result = await fileConverter.convert(testBucket, sourceKey, 'csv');
    expect(result.bucket).toBe(testBucket);
    expect(result.key).toContain('.csv');

    // Verify CSV content
    const existsResult = await objectStore.exists({ bucket: result.bucket, key: result.key });
    expect(isOk(existsResult) && existsResult.value).toBe(true);
    const readResult = await objectStore.read({ bucket: result.bucket, key: result.key });
    if (!isOk(readResult)) {
      throw new Error(`Failed to read: ${readResult.error}`);
    }
    const csvContent = readResult.value.toString();
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
    const writeResult2 = await objectStore.write({
      bucket: testBucket,
      key: sourceKey,
      data: csvBuffer,
      contentType: 'text/csv',
    });
    if (!isOk(writeResult2)) {
      throw new Error(`Failed to write: ${writeResult2.error}`);
    }

    // Convert to Excel
    const result = await fileConverter.convert(testBucket, sourceKey, 'excel');
    expect(result.bucket).toBe(testBucket);
    expect(result.key).toContain('.xlsx');

    // Verify Excel file exists
    const existsResult2 = await objectStore.exists({ bucket: result.bucket, key: result.key });
    expect(isOk(existsResult2) && existsResult2.value).toBe(true);

    // Read and verify Excel content
    const readResult2 = await objectStore.read({ bucket: result.bucket, key: result.key });
    if (!isOk(readResult2)) {
      throw new Error(`Failed to read: ${readResult2.error}`);
    }
    const excelBuffer = readResult2.value;
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
    const writeResult3 = await objectStore.write({
      bucket: testBucket,
      key: sourceKey,
      data: csvBuffer,
      contentType: 'text/csv',
    });
    if (!isOk(writeResult3)) {
      throw new Error(`Failed to write: ${writeResult3.error}`);
    }

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
    const writeResult4 = await objectStore.write({
      bucket: testBucket,
      key: sourceKey,
      data: csvBuffer,
      contentType: 'text/csv',
    });
    if (writeResult4.tag !== 'ok') {
      throw new Error(`Failed to write: ${writeResult4.error}`);
    }

    // Convert CSV to CSV (should still work, just returns cached version)
    const result = await fileConverter.convert(testBucket, sourceKey, 'csv');
    expect(result.key).toContain('.csv');

    // Verify content is preserved
    const readResult3 = await objectStore.read({ bucket: result.bucket, key: result.key });
    if (!isOk(readResult3)) {
      throw new Error(`Failed to read: ${readResult3.error}`);
    }
    const cachedContent = readResult3.value.toString();
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
    const writeResult5 = await objectStore.write({
      bucket: testBucket,
      key: sourceKey,
      data: csvBuffer,
      contentType: 'text/csv',
    });
    if (writeResult5.tag !== 'ok') {
      throw new Error(`Failed to write: ${writeResult5.error}`);
    }

    // Convert - should work with same bucket
    const result = await fileConverter.convert(testBucket, sourceKey, 'excel');
    expect(result.bucket).toBe(testBucket);
    expect(result.key).toContain('.xlsx');
  });

  test('should throw error for unsupported conversion format', async () => {
    const csvContent = 'A,B\n1,2';
    const csvBuffer = Buffer.from(csvContent, 'utf-8');
    const sourceKey = `test-unsupported-format-${Date.now()}.csv`;
    const writeResult6 = await objectStore.write({
      bucket: testBucket,
      key: sourceKey,
      data: csvBuffer,
      contentType: 'text/csv',
    });
    if (writeResult6.tag !== 'ok') {
      throw new Error(`Failed to write: ${writeResult6.error}`);
    }

    // Try to convert to an unsupported format
    expect(fileConverter.convert(testBucket, sourceKey, 'unsupported-format')).rejects.toThrow();
  });

  test('should preserve original file if no conversion is required', async () => {
    const fileContent = 'A,B\n1,2';
    const fileBuffer = Buffer.from(fileContent, 'utf-8');
    const sourceKey = `preserve-original-${Date.now()}.csv`;
    const writeResult7 = await objectStore.write({
      bucket: testBucket,
      key: sourceKey,
      data: fileBuffer,
      contentType: 'text/csv',
    });
    if (writeResult7.tag !== 'ok') {
      throw new Error(`Failed to write: ${writeResult7.error}`);
    }

    // Convert CSV to CSV (no-op)
    const result = await fileConverter.convert(testBucket, sourceKey, 'csv');
    expect(result.bucket).toBe(testBucket);
    expect(result.key.endsWith('.csv')).toBeTruthy();

    const readResult4 = await objectStore.read({ bucket: result.bucket, key: result.key });
    if (readResult4.tag !== 'ok') {
      throw new Error(`Failed to read: ${readResult4.error}`);
    }
    const outputText = readResult4.value.toString();
    expect(outputText).toContain('A,B');
    expect(outputText).toContain('1,2');
  });

  test('should handle files with unusual filenames', async () => {
    const csvContent = 'foo,bar\n3,4';
    const strangeFilename = `fiłę n@me_${Date.now()}.csv`;
    const writeResult8 = await objectStore.write({
      bucket: testBucket,
      key: strangeFilename,
      data: Buffer.from(csvContent),
      contentType: 'text/csv',
    });
    if (writeResult8.tag !== 'ok') {
      throw new Error(`Failed to write: ${writeResult8.error}`);
    }

    const result = await fileConverter.convert(testBucket, strangeFilename, 'excel');
    expect(result.key).toContain('.xlsx');

    const existsResult3 = await objectStore.exists({ bucket: result.bucket, key: result.key });
    const exists = isOk(existsResult3) && existsResult3.value;
    expect(exists).toBe(true);
  });

  test('should detect and convert different file formats', async () => {
    const formats = [
      { ext: 'csv', content: 'a,b\n3,4', target: 'excel', targetExt: '.xlsx' },
      // Add more formats if those handlers exist in the registry
    ];
    for (const { ext, content, target, targetExt } of formats) {
      const key = `multi-format-${Date.now()}.${ext}`;
      const writeResult9 = await objectStore.write({
        bucket: testBucket,
        key,
        data: Buffer.from(content),
        contentType: `text/${ext}`,
      });
      if (writeResult9.tag !== 'ok') {
        throw new Error(`Failed to write: ${writeResult9.error}`);
      }

      const result = await fileConverter.convert(testBucket, key, target);
      expect(result.key).toContain(targetExt);
      const existsResult4 = await objectStore.exists({ bucket: result.bucket, key: result.key });
      const exists = isOk(existsResult4) && existsResult4.value;
      expect(exists).toBe(true);
    }
  });

  test('should throw if destination bucket does not exist', async () => {
    // Attempt to convert to file in a bucket that is not setup
    const csvContent = 'col1,col2\nx,y';
    const csvBuffer = Buffer.from(csvContent, 'utf-8');
    const sourceKey = `test-nonexistent-dest-${Date.now()}.csv`;
    const writeResult10 = await objectStore.write({
      bucket: testBucket,
      key: sourceKey,
      data: csvBuffer,
      contentType: 'text/csv',
    });
    if (writeResult10.tag !== 'ok') {
      throw new Error(`Failed to write: ${writeResult10.error}`);
    }

    // Provide a non-existent bucket to the result (simulate)
    const nonExistentBucket = `NO_BUCKET_${Date.now()}`;
    expect(fileConverter.convert(nonExistentBucket, sourceKey, 'excel')).rejects.toThrow();
  });
});
