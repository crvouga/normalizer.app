import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { isOk } from '../../result';
import { Csv } from '../../csv/csv';
import {
  TEST_BUCKET,
  cleanupFixtures,
  setupFixtures,
  createTestTable,
  readExportedFile,
  type TestFixtures,
} from './fixtures';

describe('TabularDataPostgresExporter - Basic functionality', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('export: successfully exports table to CSV', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_export_csv';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'name', type: 'TEXT' },
        { name: 'age', type: 'TEXT' },
        { name: 'city', type: 'TEXT' },
      ],
      [
        { name: 'Alice', age: '30', city: 'New York' },
        { name: 'Bob', age: '25', city: 'San Francisco' },
        { name: 'Charlie', age: '35', city: 'Chicago' },
      ],
    );

    const exportKey = 'test-export.csv';
    const result = await exporter.export({
      tableName,
      bucket: TEST_BUCKET,
      key: exportKey,
      format: 'csv',
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(3);
      expect(result.value.fileSize).toBeGreaterThan(0);

      // Verify file exists
      const existsResult = await objectStore.exists({ bucket: TEST_BUCKET, key: exportKey });
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      // Verify file content
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      expect(csvContent).toContain('name,age,city');
      expect(csvContent).toContain('Alice,30,New York');
      expect(csvContent).toContain('Bob,25,San Francisco');
      expect(csvContent).toContain('Charlie,35,Chicago');
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: successfully exports table to XLSX', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_export_xlsx';
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
        { id: '1', name: 'Item A', value: '10.5' },
        { id: '2', name: 'Item B', value: '20.75' },
      ],
    );

    const exportKey = 'test-export.xlsx';
    const result = await exporter.export({
      tableName,
      bucket: TEST_BUCKET,
      key: exportKey,
      format: 'xlsx',
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(2);
      expect(result.value.fileSize).toBeGreaterThan(0);

      // Verify file exists
      const existsResult = await objectStore.exists({ bucket: TEST_BUCKET, key: exportKey });
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      // Verify file is XLSX format (starts with PK signature for ZIP-based formats)
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      expect(fileData[0]).toBe(0x50); // 'P' from PK signature
      expect(fileData[1]).toBe(0x4b); // 'K' from PK signature
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: successfully exports table to Parquet', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_export_parquet';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
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

    const exportKey = 'test-export.parquet';
    const result = await exporter.export({
      tableName,
      bucket: TEST_BUCKET,
      key: exportKey,
      format: 'parquet',
    });

    if (!isOk(result)) {
      console.error('Parquet export failed:', result.error);
    }
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(2);
      expect(result.value.fileSize).toBeGreaterThan(0);

      // Verify file exists
      const existsResult = await objectStore.exists({ bucket: TEST_BUCKET, key: exportKey });
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: successfully exports table to JSON', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_export_json';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'name', type: 'TEXT' },
        { name: 'age', type: 'TEXT' },
      ],
      [
        { name: 'Alice', age: '30' },
        { name: 'Bob', age: '25' },
      ],
    );

    const exportKey = 'test-export.json';
    const result = await exporter.export({
      tableName,
      bucket: TEST_BUCKET,
      key: exportKey,
      format: 'json',
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(2);
      expect(result.value.fileSize).toBeGreaterThan(0);

      // Verify file exists
      const existsResult = await objectStore.exists({ bucket: TEST_BUCKET, key: exportKey });
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      // Verify JSON structure
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const jsonContent = JSON.parse(fileData.toString('utf-8'));
      expect(Array.isArray(jsonContent)).toBe(true);
      expect(jsonContent.length).toBe(2);
      expect(jsonContent[0]).toHaveProperty('name');
      expect(jsonContent[0]).toHaveProperty('age');
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: successfully exports with custom query to CSV', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_query_export';
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

    const exportKey = 'test-query-export.csv';
    const result = await exporter.export({
      query: `SELECT name, value FROM ${postgresClient.escapeIdentifier(tableName)} WHERE value::integer > 15 ORDER BY value`,
      bucket: TEST_BUCKET,
      key: exportKey,
      format: 'csv',
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(2); // Only rows with value > 15

      // Verify file content
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      expect(csvContent).toContain('name,value');
      expect(csvContent).toContain('Item B,20');
      expect(csvContent).toContain('Item C,30');
      expect(csvContent).not.toContain('Item A'); // Should be filtered out
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: verifies exported data matches source', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_data_match';
    testTables.push(tableName);

    const sourceData = [
      { name: 'Alice', age: '30', city: 'New York' },
      { name: 'Bob', age: '25', city: 'San Francisco' },
    ];

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'name', type: 'TEXT' },
        { name: 'age', type: 'TEXT' },
        { name: 'city', type: 'TEXT' },
      ],
      sourceData,
    );

    const exportKey = 'test-data-match.csv';
    const result = await exporter.export({
      tableName,
      bucket: TEST_BUCKET,
      key: exportKey,
      format: 'csv',
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(2);

      // Read and parse exported CSV
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      const parsed = Csv.parse(csvContent);

      expect(parsed.headers).toEqual(['name', 'age', 'city']);
      expect(parsed.dataRows.length).toBe(2);
      expect(parsed.dataRows[0]).toEqual(['Alice', '30', 'New York']);
      expect(parsed.dataRows[1]).toEqual(['Bob', '25', 'San Francisco']);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: verifies file exists in object store', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_file_exists';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [{ name: 'col1', type: 'TEXT' }],
      [{ col1: 'value1' }],
    );

    const exportKey = 'test-file-exists.csv';
    const result = await exporter.export({
      tableName,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);

    // Verify file exists
    const existsResult = await objectStore.exists({ bucket: TEST_BUCKET, key: exportKey });
    expect(isOk(existsResult)).toBe(true);
    if (isOk(existsResult)) {
      expect(existsResult.value).toBe(true);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: verifies row count is correct', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_row_count';
    testTables.push(tableName);

    const rowCount = 10;
    const rows = Array.from({ length: rowCount }, (_, i) => ({
      id: String(i + 1),
      name: `Item ${i + 1}`,
    }));

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
      ],
      rows,
    );

    const exportKey = 'test-row-count.csv';
    const result = await exporter.export({
      tableName,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(rowCount);

      // Verify actual CSV has correct number of rows
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);
      expect(lines.length).toBe(rowCount + 1); // +1 for header
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });
});
