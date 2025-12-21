import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { isOk } from '../../result';
import { Csv } from '../../csv/csv';
import {
  TEST_BUCKET,
  cleanupFixtures,
  setupFixtures,
  writeCsvToS3,
  type TestFixtures,
} from './fixtures';

describe('TabularDataPostgresImporter - Batch importing', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('importBatch: successfully imports multiple files in parallel', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent1 = Csv.builder([
      { id: 1, name: 'Item A', value: 10 },
      { id: 2, name: 'Item B', value: 20 },
    ]).toString();
    const csvContent2 = Csv.builder([
      { name: 'Alice', age: 30, city: 'New York' },
      { name: 'Bob', age: 25, city: 'San Francisco' },
    ]).toString();
    const csvContent3 = Csv.builder([
      { product: 'Widget', price: 19.99, stock: 100 },
      { product: 'Gadget', price: 29.99, stock: 50 },
    ]).toString();

    const testKey1 = 'test-batch-1.csv';
    const testKey2 = 'test-batch-2.csv';
    const testKey3 = 'test-batch-3.csv';

    await writeCsvToS3(objectStore, testKey1, csvContent1);
    await writeCsvToS3(objectStore, testKey2, csvContent2);
    await writeCsvToS3(objectStore, testKey3, csvContent3);

    const tableName1 = 'test_batch_table_1';
    const tableName2 = 'test_batch_table_2';
    const tableName3 = 'test_batch_table_3';
    testTables.push(tableName1, tableName2, tableName3);

    const batchResult = await importer.importBatch([
      { bucket: TEST_BUCKET, key: testKey1, options: { viewName: tableName1 } },
      { bucket: TEST_BUCKET, key: testKey2, options: { viewName: tableName2 } },
      { bucket: TEST_BUCKET, key: testKey3, options: { viewName: tableName3 } },
    ]);

    expect(batchResult.summary.total).toBe(3);
    expect(batchResult.summary.successful).toBe(3);
    expect(batchResult.summary.failed).toBe(0);
    expect(batchResult.summary.totalRowsImported).toBe(6);
    expect(batchResult.summary.duration).toBeGreaterThan(0);
    expect(batchResult.results.length).toBe(3);

    // Verify all results are successful
    for (const itemResult of batchResult.results) {
      expect(isOk(itemResult.result)).toBe(true);
      if (isOk(itemResult.result)) {
        expect(itemResult.result.value.rowCount).toBeGreaterThan(0);
      }
    }

    // Verify all tables exist
    for (const tableName of [tableName1, tableName2, tableName3]) {
      const existsResult = await postgresClient.tableExists(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey1 });
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey2 });
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey3 });
  });

  test('importBatch: handles empty request array', async () => {
    const { importer } = fixtures;

    const batchResult = await importer.importBatch([]);

    expect(batchResult.summary.total).toBe(0);
    expect(batchResult.summary.successful).toBe(0);
    expect(batchResult.summary.failed).toBe(0);
    expect(batchResult.summary.totalRowsImported).toBe(0);
    expect(batchResult.summary.duration).toBe(0);
    expect(batchResult.results.length).toBe(0);
  });

  test('importBatch: handles mix of successful and failed imports', async () => {
    const { importer, objectStore, testTables } = fixtures;

    const csvContent1 = Csv.builder([
      { id: 1, name: 'Item A' },
      { id: 2, name: 'Item B' },
    ]).toString();
    const csvContent2 = Csv.builder([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]).toString();

    const testKey1 = 'test-batch-mix-1.csv';
    const testKey2 = 'test-batch-mix-2.csv';
    const nonExistentKey = 'non-existent-file.csv';

    await writeCsvToS3(objectStore, testKey1, csvContent1);
    await writeCsvToS3(objectStore, testKey2, csvContent2);

    const tableName1 = 'test_batch_mix_1';
    const tableName2 = 'test_batch_mix_2';
    const tableName3 = 'test_batch_mix_3';
    testTables.push(tableName1, tableName2);

    const batchResult = await importer.importBatch([
      { bucket: TEST_BUCKET, key: testKey1, options: { viewName: tableName1 } },
      { bucket: TEST_BUCKET, key: nonExistentKey, options: { viewName: tableName3 } },
      { bucket: TEST_BUCKET, key: testKey2, options: { viewName: tableName2 } },
    ]);

    expect(batchResult.summary.total).toBe(3);
    expect(batchResult.summary.successful).toBe(2);
    expect(batchResult.summary.failed).toBe(1);
    expect(batchResult.summary.totalRowsImported).toBe(4);
    expect(batchResult.results.length).toBe(3);

    // Verify first result is successful
    expect(isOk(batchResult.results[0]!.result)).toBe(true);
    if (isOk(batchResult.results[0]!.result)) {
      expect(batchResult.results[0]!.result.value.rowCount).toBe(2);
    }

    // Verify second result is failed
    expect(isOk(batchResult.results[1]!.result)).toBe(false);
    if (!isOk(batchResult.results[1]!.result)) {
      expect(batchResult.results[1]!.result.error).toBeDefined();
      expect(batchResult.results[1]!.result.error).toContain('Failed to import tabular data');
    }

    // Verify third result is successful
    expect(isOk(batchResult.results[2]!.result)).toBe(true);
    if (isOk(batchResult.results[2]!.result)) {
      expect(batchResult.results[2]!.result.value.rowCount).toBe(2);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey1 });
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey2 });
  });

  test('importBatch: handles batch with different table options', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent1 = Csv.builder([
      { col1: 'A', col2: 1 },
      { col1: 'B', col2: 2 },
    ]).toString();
    const csvContent2 = Csv.builder([
      { col1: 'X', col2: 10 },
      { col1: 'Y', col2: 20 },
    ]).toString();
    const csvContent3 = Csv.builder([
      { name: 'First', value: 1 },
      { name: 'Second', value: 2 },
    ]).toString();

    const testKey1 = 'test-batch-options-1.csv';
    const testKey2 = 'test-batch-options-2.csv';
    const testKey3 = 'test-batch-options-3.csv';

    await writeCsvToS3(objectStore, testKey1, csvContent1);
    await writeCsvToS3(objectStore, testKey2, csvContent2);
    await writeCsvToS3(objectStore, testKey3, csvContent3);

    const tableName1 = 'test_batch_options_1';
    const tableName2 = 'test_batch_options_2';
    const tableName3 = 'test_batch_options_3';
    testTables.push(tableName1, tableName2, tableName3);

    const batchResult = await importer.importBatch([
      { bucket: TEST_BUCKET, key: testKey1, options: { viewName: tableName1 } },
      {
        bucket: TEST_BUCKET,
        key: testKey2,
        options: { viewName: tableName2, dropIfExists: true },
      },
      {
        bucket: TEST_BUCKET,
        key: testKey3,
        options: { viewName: tableName3, truncate: true },
      },
    ]);

    expect(batchResult.summary.successful).toBe(3);
    expect(batchResult.summary.failed).toBe(0);

    // Verify all tables exist and have correct row counts
    const rowCount1 = await postgresClient.getTableRowCount(tableName1);
    expect(isOk(rowCount1)).toBe(true);
    if (isOk(rowCount1)) {
      expect(rowCount1.value).toBe(2);
    }

    const rowCount2 = await postgresClient.getTableRowCount(tableName2);
    expect(isOk(rowCount2)).toBe(true);
    if (isOk(rowCount2)) {
      expect(rowCount2.value).toBe(2);
    }

    const rowCount3 = await postgresClient.getTableRowCount(tableName3);
    expect(isOk(rowCount3)).toBe(true);
    if (isOk(rowCount3)) {
      expect(rowCount3.value).toBe(2);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey1 });
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey2 });
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey3 });
  });

  test('importBatch: includes correct request context in results', async () => {
    const { importer, objectStore, testTables } = fixtures;

    const csvContent = Csv.builder([
      { id: 1, name: 'Item A' },
      { id: 2, name: 'Item B' },
    ]).toString();

    const testKey = 'test-batch-context.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test_batch_context';
    testTables.push(tableName);

    const request = {
      bucket: TEST_BUCKET,
      key: testKey,
      options: { viewName: tableName, dropIfExists: true },
    };

    const batchResult = await importer.importBatch([request]);

    expect(batchResult.results.length).toBe(1);
    const itemResult = batchResult.results[0]!;

    // Verify request context is preserved
    expect(itemResult.request.bucket).toBe(request.bucket);
    expect(itemResult.request.key).toBe(request.key);
    expect(itemResult.request.options.viewName).toBe(request.options.viewName);
    expect(itemResult.request.options.dropIfExists).toBe(request.options.dropIfExists);

    // Verify result is successful
    expect(isOk(itemResult.result)).toBe(true);

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test('importBatch: handles batch with empty CSV files', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent1 = Csv.builder([]).withHeader(['name', 'age', 'city']).toString();
    const csvContent2 = Csv.builder([
      { id: 1, value: 10 },
      { id: 2, value: 20 },
    ]).toString();

    const testKey1 = 'test-batch-empty-1.csv';
    const testKey2 = 'test-batch-empty-2.csv';

    await writeCsvToS3(objectStore, testKey1, csvContent1);
    await writeCsvToS3(objectStore, testKey2, csvContent2);

    const tableName1 = 'test_batch_empty_1';
    const tableName2 = 'test_batch_empty_2';
    testTables.push(tableName1, tableName2);

    const batchResult = await importer.importBatch([
      { bucket: TEST_BUCKET, key: testKey1, options: { viewName: tableName1 } },
      { bucket: TEST_BUCKET, key: testKey2, options: { viewName: tableName2 } },
    ]);

    expect(batchResult.summary.successful).toBe(2);
    expect(batchResult.summary.totalRowsImported).toBe(2); // Only rows from second file

    // Verify first table has 0 rows but exists
    expect(isOk(batchResult.results[0]!.result)).toBe(true);
    if (isOk(batchResult.results[0]!.result)) {
      expect(batchResult.results[0]!.result.value.rowCount).toBe(0);
    }

    const rowCount1 = await postgresClient.getTableRowCount(tableName1);
    expect(isOk(rowCount1)).toBe(true);
    if (isOk(rowCount1)) {
      expect(rowCount1.value).toBe(0);
    }

    // Verify second table has 2 rows
    expect(isOk(batchResult.results[1]!.result)).toBe(true);
    if (isOk(batchResult.results[1]!.result)) {
      expect(batchResult.results[1]!.result.value.rowCount).toBe(2);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey1 });
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey2 });
  });

  test('importBatch: processes large number of files efficiently', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const requests = [];
    const testKeys: string[] = [];
    const tableNames: string[] = [];

    // Create 5 files to import
    for (let i = 0; i < 5; i++) {
      const arr = [
        { id: i * 3 + 1, name: `Item${i * 3 + 1}`, value: (i * 3 + 1) * 10 },
        { id: i * 3 + 2, name: `Item${i * 3 + 2}`, value: (i * 3 + 2) * 10 },
        { id: i * 3 + 3, name: `Item${i * 3 + 3}`, value: (i * 3 + 3) * 10 },
      ];
      const csvContent = Csv.builder(arr).toString();

      const testKey = `test-batch-large-${i}.csv`;
      await writeCsvToS3(objectStore, testKey, csvContent);
      testKeys.push(testKey);

      const tableName = `test_batch_large_${i}`;
      tableNames.push(tableName);
      testTables.push(tableName);

      requests.push({
        bucket: TEST_BUCKET,
        key: testKey,
        options: { viewName: tableName },
      });
    }

    const batchResult = await importer.importBatch(requests);

    expect(batchResult.summary.total).toBe(5);
    expect(batchResult.summary.successful).toBe(5);
    expect(batchResult.summary.failed).toBe(0);
    expect(batchResult.summary.totalRowsImported).toBe(15); // 3 rows per file * 5 files

    // Verify all tables exist
    for (const tableName of tableNames) {
      const existsResult = await postgresClient.tableExists(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }
    }

    // Cleanup
    for (const testKey of testKeys) {
      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    }
  });

  test('importBatch: all imports fail independently', async () => {
    const { importer } = fixtures;

    const batchResult = await importer.importBatch([
      { bucket: TEST_BUCKET, key: 'non-existent-1.csv', options: { viewName: 'test_fail_1' } },
      { bucket: TEST_BUCKET, key: 'non-existent-2.csv', options: { viewName: 'test_fail_2' } },
      { bucket: TEST_BUCKET, key: 'non-existent-3.csv', options: { viewName: 'test_fail_3' } },
    ]);

    expect(batchResult.summary.total).toBe(3);
    expect(batchResult.summary.successful).toBe(0);
    expect(batchResult.summary.failed).toBe(3);
    expect(batchResult.summary.totalRowsImported).toBe(0);
    expect(batchResult.results.length).toBe(3);

    // Verify all results are failed
    for (const itemResult of batchResult.results) {
      expect(isOk(itemResult.result)).toBe(false);
      if (!isOk(itemResult.result)) {
        expect(itemResult.result.error).toBeDefined();
        expect(itemResult.result.error).toContain('Failed to import tabular data');
      }
    }
  });

  test('importBatch: summary includes accurate statistics', async () => {
    const { importer, objectStore, testTables } = fixtures;

    const csvContent1 = Csv.builder([
      { id: 1, name: 'Item A' },
      { id: 2, name: 'Item B' },
      { id: 3, name: 'Item C' },
    ]).toString();
    const csvContent2 = Csv.builder([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]).toString();

    const testKey1 = 'test-batch-stats-1.csv';
    const testKey2 = 'test-batch-stats-2.csv';

    await writeCsvToS3(objectStore, testKey1, csvContent1);
    await writeCsvToS3(objectStore, testKey2, csvContent2);

    const tableName1 = 'test_batch_stats_1';
    const tableName2 = 'test_batch_stats_2';
    testTables.push(tableName1, tableName2);

    const startTime = Date.now();
    const batchResult = await importer.importBatch([
      { bucket: TEST_BUCKET, key: testKey1, options: { viewName: tableName1 } },
      { bucket: TEST_BUCKET, key: testKey2, options: { viewName: tableName2 } },
    ]);
    const endTime = Date.now();

    // Verify summary statistics
    expect(batchResult.summary.total).toBe(2);
    expect(batchResult.summary.successful).toBe(2);
    expect(batchResult.summary.failed).toBe(0);
    expect(batchResult.summary.totalRowsImported).toBe(5); // 3 + 2
    expect(batchResult.summary.duration).toBeGreaterThanOrEqual(0);
    expect(batchResult.summary.duration).toBeLessThanOrEqual(endTime - startTime + 100); // Allow small margin

    // Verify row counts match summary
    let totalRowsFromResults = 0;
    for (const itemResult of batchResult.results) {
      if (isOk(itemResult.result)) {
        totalRowsFromResults += itemResult.result.value.rowCount;
      }
    }
    expect(totalRowsFromResults).toBe(batchResult.summary.totalRowsImported);

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey1 });
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey2 });
  });
});
