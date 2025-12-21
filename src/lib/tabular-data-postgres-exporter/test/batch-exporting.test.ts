import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { isOk } from '../../result';
import {
  TEST_BUCKET,
  cleanupFixtures,
  setupFixtures,
  createTestTable,
  type TestFixtures,
} from './fixtures';

describe('TabularDataPostgresExporter - Batch exporting', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('exportBatch: successfully exports multiple tables in parallel', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName1 = 'test_batch_1';
    const tableName2 = 'test_batch_2';
    const tableName3 = 'test_batch_3';
    testTables.push(tableName1, tableName2, tableName3);

    await createTestTable(
      postgresClient,
      tableName1,
      [
        { name: 'id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
        { name: 'value', type: 'TEXT' },
      ],
      [
        { id: '1', name: 'Item A', value: '10' },
        { id: '2', name: 'Item B', value: '20' },
      ],
    );

    await createTestTable(
      postgresClient,
      tableName2,
      [
        { name: 'name', type: 'TEXT' },
        { name: 'age', type: 'TEXT' },
        { name: 'city', type: 'TEXT' },
      ],
      [
        { name: 'Alice', age: '30', city: 'New York' },
        { name: 'Bob', age: '25', city: 'San Francisco' },
      ],
    );

    await createTestTable(
      postgresClient,
      tableName3,
      [
        { name: 'product', type: 'TEXT' },
        { name: 'price', type: 'TEXT' },
        { name: 'stock', type: 'TEXT' },
      ],
      [
        { product: 'Widget', price: '19.99', stock: '100' },
        { product: 'Gadget', price: '29.99', stock: '50' },
      ],
    );

    const batchResult = await exporter.exportBatch([
      { tableName: tableName1, bucket: TEST_BUCKET, key: 'test-batch-1.csv' },
      { tableName: tableName2, bucket: TEST_BUCKET, key: 'test-batch-2.csv' },
      { tableName: tableName3, bucket: TEST_BUCKET, key: 'test-batch-3.csv' },
    ]);

    expect(batchResult.summary.total).toBe(3);
    expect(batchResult.summary.successful).toBe(3);
    expect(batchResult.summary.failed).toBe(0);
    expect(batchResult.summary.totalRowsExported).toBe(6);
    expect(batchResult.summary.duration).toBeGreaterThan(0);
    expect(batchResult.results.length).toBe(3);

    // Verify all results are successful
    for (const itemResult of batchResult.results) {
      expect(isOk(itemResult.result)).toBe(true);
      if (isOk(itemResult.result)) {
        expect(itemResult.result.value.rowCount).toBeGreaterThan(0);
        expect(itemResult.result.value.fileSize).toBeGreaterThan(0);
      }
    }

    // Verify all files exist
    const exists1 = await objectStore.exists({ bucket: TEST_BUCKET, key: 'test-batch-1.csv' });
    expect(isOk(exists1)).toBe(true);
    if (isOk(exists1)) {
      expect(exists1.value).toBe(true);
    }

    const exists2 = await objectStore.exists({ bucket: TEST_BUCKET, key: 'test-batch-2.csv' });
    expect(isOk(exists2)).toBe(true);
    if (isOk(exists2)) {
      expect(exists2.value).toBe(true);
    }

    const exists3 = await objectStore.exists({ bucket: TEST_BUCKET, key: 'test-batch-3.csv' });
    expect(isOk(exists3)).toBe(true);
    if (isOk(exists3)) {
      expect(exists3.value).toBe(true);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-1.csv' });
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-2.csv' });
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-3.csv' });
  });

  test('exportBatch: handles empty request array', async () => {
    const { exporter } = fixtures;

    const batchResult = await exporter.exportBatch([]);

    expect(batchResult.summary.total).toBe(0);
    expect(batchResult.summary.successful).toBe(0);
    expect(batchResult.summary.failed).toBe(0);
    expect(batchResult.summary.totalRowsExported).toBe(0);
    expect(batchResult.summary.totalFileSize).toBe(0);
    expect(batchResult.summary.duration).toBe(0);
    expect(batchResult.results.length).toBe(0);
  });

  test('exportBatch: handles mix of successful and failed exports', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName1 = 'test_batch_mix_1';
    const tableName2 = 'test_batch_mix_2';
    testTables.push(tableName1, tableName2);

    await createTestTable(
      postgresClient,
      tableName1,
      [
        { name: 'id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
      ],
      [
        { id: '1', name: 'Item A' },
        { id: '2', name: 'Item B' },
      ],
    );

    await createTestTable(
      postgresClient,
      tableName2,
      [
        { name: 'name', type: 'TEXT' },
        { name: 'age', type: 'TEXT' },
      ],
      [
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ],
    );

    const batchResult = await exporter.exportBatch([
      { tableName: tableName1, bucket: TEST_BUCKET, key: 'test-batch-mix-1.csv' },
      { tableName: 'non_existent_table', bucket: TEST_BUCKET, key: 'test-batch-mix-fail.csv' },
      { tableName: tableName2, bucket: TEST_BUCKET, key: 'test-batch-mix-2.csv' },
    ]);

    expect(batchResult.summary.total).toBe(3);
    expect(batchResult.summary.successful).toBe(2);
    expect(batchResult.summary.failed).toBe(1);
    expect(batchResult.summary.totalRowsExported).toBe(4);
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
      expect(batchResult.results[1]!.result.error).toContain('Failed to export tabular data');
    }

    // Verify third result is successful
    expect(isOk(batchResult.results[2]!.result)).toBe(true);
    if (isOk(batchResult.results[2]!.result)) {
      expect(batchResult.results[2]!.result.value.rowCount).toBe(2);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-mix-1.csv' });
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-mix-2.csv' });
  });

  test('exportBatch: handles batch with different output formats', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName1 = 'test_batch_format_1';
    const tableName2 = 'test_batch_format_2';
    const tableName3 = 'test_batch_format_3';
    testTables.push(tableName1, tableName2, tableName3);

    await createTestTable(
      postgresClient,
      tableName1,
      [
        { name: 'col1', type: 'TEXT' },
        { name: 'col2', type: 'TEXT' },
      ],
      [
        { col1: 'A', col2: '1' },
        { col1: 'B', col2: '2' },
      ],
    );

    await createTestTable(
      postgresClient,
      tableName2,
      [
        { name: 'col1', type: 'TEXT' },
        { name: 'col2', type: 'TEXT' },
      ],
      [
        { col1: 'X', col2: '10' },
        { col1: 'Y', col2: '20' },
      ],
    );

    await createTestTable(
      postgresClient,
      tableName3,
      [
        { name: 'name', type: 'TEXT' },
        { name: 'value', type: 'TEXT' },
      ],
      [
        { name: 'First', value: '1' },
        { name: 'Second', value: '2' },
      ],
    );

    const batchResult = await exporter.exportBatch([
      { tableName: tableName1, bucket: TEST_BUCKET, key: 'test-batch-format-1.csv', format: 'csv' },
      {
        tableName: tableName2,
        bucket: TEST_BUCKET,
        key: 'test-batch-format-2.xlsx',
        format: 'xlsx',
      },
      {
        tableName: tableName3,
        bucket: TEST_BUCKET,
        key: 'test-batch-format-3.json',
        format: 'json',
      },
    ]);

    expect(batchResult.summary.successful).toBe(3);
    expect(batchResult.summary.failed).toBe(0);

    // Verify all files exist
    const exists1 = await objectStore.exists({
      bucket: TEST_BUCKET,
      key: 'test-batch-format-1.csv',
    });
    expect(isOk(exists1)).toBe(true);
    if (isOk(exists1)) {
      expect(exists1.value).toBe(true);
    }

    const exists2 = await objectStore.exists({
      bucket: TEST_BUCKET,
      key: 'test-batch-format-2.xlsx',
    });
    expect(isOk(exists2)).toBe(true);
    if (isOk(exists2)) {
      expect(exists2.value).toBe(true);
    }

    const exists3 = await objectStore.exists({
      bucket: TEST_BUCKET,
      key: 'test-batch-format-3.json',
    });
    expect(isOk(exists3)).toBe(true);
    if (isOk(exists3)) {
      expect(exists3.value).toBe(true);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-format-1.csv' });
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-format-2.xlsx' });
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-format-3.json' });
  });

  test('exportBatch: handles batch with tables and queries mixed', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_batch_mixed';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
        { name: 'value', type: 'TEXT' },
      ],
      [
        { id: '1', name: 'Item A', value: '10' },
        { id: '2', name: 'Item B', value: '20' },
        { id: '3', name: 'Item C', value: '30' },
      ],
    );

    const batchResult = await exporter.exportBatch([
      { tableName, bucket: TEST_BUCKET, key: 'test-batch-mixed-table.csv' },
      {
        query: `SELECT name, value FROM ${postgresClient.escapeIdentifier(tableName)} WHERE value::integer > 15`,
        bucket: TEST_BUCKET,
        key: 'test-batch-mixed-query.csv',
      },
    ]);

    expect(batchResult.summary.successful).toBe(2);
    expect(batchResult.summary.failed).toBe(0);

    // Verify table export has 3 rows
    expect(isOk(batchResult.results[0]!.result)).toBe(true);
    if (isOk(batchResult.results[0]!.result)) {
      expect(batchResult.results[0]!.result.value.rowCount).toBe(3);
    }

    // Verify query export has 2 rows (filtered)
    expect(isOk(batchResult.results[1]!.result)).toBe(true);
    if (isOk(batchResult.results[1]!.result)) {
      expect(batchResult.results[1]!.result.value.rowCount).toBe(2);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-mixed-table.csv' });
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-mixed-query.csv' });
  });

  test('exportBatch: processes large number of exports efficiently', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const requests = [];
    const tableNames: string[] = [];
    const exportKeys: string[] = [];

    // Create 5 tables to export
    for (let i = 0; i < 5; i++) {
      const tableName = `test_batch_large_${i}`;
      tableNames.push(tableName);
      testTables.push(tableName);

      await createTestTable(
        postgresClient,
        tableName,
        [
          { name: 'id', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
          { name: 'value', type: 'TEXT' },
        ],
        [
          { id: String(i * 3 + 1), name: `Item${i * 3 + 1}`, value: String((i * 3 + 1) * 10) },
          { id: String(i * 3 + 2), name: `Item${i * 3 + 2}`, value: String((i * 3 + 2) * 10) },
          { id: String(i * 3 + 3), name: `Item${i * 3 + 3}`, value: String((i * 3 + 3) * 10) },
        ],
      );

      const exportKey = `test-batch-large-${i}.csv`;
      exportKeys.push(exportKey);

      requests.push({
        tableName,
        bucket: TEST_BUCKET,
        key: exportKey,
      });
    }

    const batchResult = await exporter.exportBatch(requests);

    expect(batchResult.summary.total).toBe(5);
    expect(batchResult.summary.successful).toBe(5);
    expect(batchResult.summary.failed).toBe(0);
    expect(batchResult.summary.totalRowsExported).toBe(15); // 3 rows per table * 5 tables

    // Verify all files exist
    for (const exportKey of exportKeys) {
      const existsResult = await objectStore.exists({ bucket: TEST_BUCKET, key: exportKey });
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }
    }

    // Cleanup
    for (const exportKey of exportKeys) {
      await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
    }
  });

  test('exportBatch: all exports fail independently', async () => {
    const { exporter } = fixtures;

    const batchResult = await exporter.exportBatch([
      { tableName: 'non_existent_1', bucket: TEST_BUCKET, key: 'test-fail-1.csv' },
      { tableName: 'non_existent_2', bucket: TEST_BUCKET, key: 'test-fail-2.csv' },
      { tableName: 'non_existent_3', bucket: TEST_BUCKET, key: 'test-fail-3.csv' },
    ]);

    expect(batchResult.summary.total).toBe(3);
    expect(batchResult.summary.successful).toBe(0);
    expect(batchResult.summary.failed).toBe(3);
    expect(batchResult.summary.totalRowsExported).toBe(0);
    expect(batchResult.results.length).toBe(3);

    // Verify all results are failed
    for (const itemResult of batchResult.results) {
      expect(isOk(itemResult.result)).toBe(false);
      if (!isOk(itemResult.result)) {
        expect(itemResult.result.error).toBeDefined();
        expect(itemResult.result.error).toContain('Failed to export tabular data');
      }
    }
  });

  test('exportBatch: summary includes accurate statistics', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName1 = 'test_batch_stats_1';
    const tableName2 = 'test_batch_stats_2';
    testTables.push(tableName1, tableName2);

    await createTestTable(
      postgresClient,
      tableName1,
      [
        { name: 'id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
      ],
      [
        { id: '1', name: 'Item A' },
        { id: '2', name: 'Item B' },
        { id: '3', name: 'Item C' },
      ],
    );

    await createTestTable(
      postgresClient,
      tableName2,
      [
        { name: 'name', type: 'TEXT' },
        { name: 'age', type: 'TEXT' },
      ],
      [
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ],
    );

    const startTime = Date.now();
    const batchResult = await exporter.exportBatch([
      { tableName: tableName1, bucket: TEST_BUCKET, key: 'test-batch-stats-1.csv' },
      { tableName: tableName2, bucket: TEST_BUCKET, key: 'test-batch-stats-2.csv' },
    ]);
    const endTime = Date.now();

    // Verify summary statistics
    expect(batchResult.summary.total).toBe(2);
    expect(batchResult.summary.successful).toBe(2);
    expect(batchResult.summary.failed).toBe(0);
    expect(batchResult.summary.totalRowsExported).toBe(5); // 3 + 2
    expect(batchResult.summary.totalFileSize).toBeGreaterThan(0);
    expect(batchResult.summary.duration).toBeGreaterThanOrEqual(0);
    expect(batchResult.summary.duration).toBeLessThanOrEqual(endTime - startTime + 100); // Allow small margin

    // Verify row counts match summary
    let totalRowsFromResults = 0;
    let totalSizeFromResults = 0;
    for (const itemResult of batchResult.results) {
      if (isOk(itemResult.result)) {
        totalRowsFromResults += itemResult.result.value.rowCount;
        totalSizeFromResults += itemResult.result.value.fileSize;
      }
    }
    expect(totalRowsFromResults).toBe(batchResult.summary.totalRowsExported);
    expect(totalSizeFromResults).toBe(batchResult.summary.totalFileSize);

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-stats-1.csv' });
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-stats-2.csv' });
  });

  test('exportBatch: includes correct request context in results', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_batch_context';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
      ],
      [
        { id: '1', name: 'Item A' },
        { id: '2', name: 'Item B' },
      ],
    );

    const request = {
      tableName,
      bucket: TEST_BUCKET,
      key: 'test-batch-context.csv',
      format: 'csv' as const,
    };

    const batchResult = await exporter.exportBatch([request]);

    expect(batchResult.results.length).toBe(1);
    const itemResult = batchResult.results[0]!;

    // Verify request context is preserved
    expect(itemResult.request.tableName).toBe(request.tableName);
    expect(itemResult.request.bucket).toBe(request.bucket);
    expect(itemResult.request.key).toBe(request.key);
    expect(itemResult.request.format).toBe(request.format);

    // Verify result is successful
    expect(isOk(itemResult.result)).toBe(true);

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: 'test-batch-context.csv' });
  });
});
