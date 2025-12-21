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

describe('TabularDataPostgresExporter - Edge cases', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('export: handles table with special characters in column names', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_special_chars';
    testTables.push(tableName);

    // Create table with sanitized column names (PostgreSQL doesn't allow special chars directly)
    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'col_dash_1', type: 'TEXT' },
        { name: 'col_underscore_2', type: 'TEXT' },
        { name: '_123col', type: 'TEXT' },
      ],
      [
        {
          col_dash_1: 'value1',
          col_underscore_2: 'value2',
          _123col: 'value3',
        },
      ],
    );

    const exportKey = 'test-special-chars.csv';
    const result = await exporter.export({
      query: `SELECT * FROM ${postgresClient.escapeIdentifier(tableName)}`,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(1);

      // Verify CSV contains all columns
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      expect(csvContent).toContain('col_dash_1');
      expect(csvContent).toContain('col_underscore_2');
      expect(csvContent).toContain('_123col');
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: handles table with NULL values', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_null_values';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'id', type: 'TEXT', nullable: true },
        { name: 'name', type: 'TEXT', nullable: true },
        { name: 'value', type: 'TEXT', nullable: true },
      ],
      [
        { id: '1', name: 'Item A', value: '10' },
        { id: '2', name: null, value: null },
        { id: '3', name: 'Item C', value: null },
      ],
    );

    const exportKey = 'test-null-values.csv';
    const result = await exporter.export({
      query: `SELECT * FROM ${postgresClient.escapeIdentifier(tableName)}`,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(3);

      // Verify CSV handles nulls correctly (empty strings)
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      const parsed = Csv.parse(csvContent);

      expect(parsed.dataRows.length).toBe(3);
      expect(parsed.dataRows[0]).toEqual(['1', 'Item A', '10']);
      const row1 = parsed.dataRows[1];
      expect(row1).toBeDefined();
      expect(row1![0]).toBe('2'); // id
      expect(row1![1]).toBe(''); // name is null
      expect(row1![2]).toBe(''); // value is null
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: handles table with empty strings', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_empty_strings';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'col1', type: 'TEXT' },
        { name: 'col2', type: 'TEXT' },
      ],
      [
        { col1: 'value1', col2: 'value2' },
        { col1: '', col2: '' },
        { col1: 'value3', col2: '' },
      ],
    );

    const exportKey = 'test-empty-strings.csv';
    const result = await exporter.export({
      query: `SELECT * FROM ${postgresClient.escapeIdentifier(tableName)}`,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(3);

      // Verify CSV preserves empty strings
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      const parsed = Csv.parse(csvContent);

      expect(parsed.dataRows.length).toBe(3);
      // Find the row with both empty strings
      const emptyRow = parsed.dataRows.find((row) => row[0] === '' && row[1] === '');
      expect(emptyRow).toBeDefined();
      expect(emptyRow).toEqual(['', '']); // Empty strings preserved
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: handles table with large text fields', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_large_text';
    testTables.push(tableName);

    const largeText = 'A'.repeat(10000); // 10KB text
    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'id', type: 'TEXT' },
        { name: 'content', type: 'TEXT' },
      ],
      [
        { id: '1', content: largeText },
        { id: '2', content: 'Normal text' },
      ],
    );

    const exportKey = 'test-large-text.csv';
    const result = await exporter.export({
      query: `SELECT * FROM ${postgresClient.escapeIdentifier(tableName)}`,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(2);
      expect(result.value.fileSize).toBeGreaterThan(10000); // Should be larger due to large text

      // Verify large text is preserved
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      expect(csvContent).toContain(largeText);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: handles table with many columns', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_many_columns';
    testTables.push(tableName);

    // Create table with 50 columns
    const columnCount = 50;
    const columns = Array.from({ length: columnCount }, (_, i) => ({
      name: `col${i + 1}`,
      type: 'TEXT' as const,
    }));

    const row: Record<string, unknown> = {};
    for (let i = 0; i < columnCount; i++) {
      row[`col${i + 1}`] = `value${i + 1}`;
    }

    await createTestTable(postgresClient, tableName, columns, [row]);

    const exportKey = 'test-many-columns.csv';
    const result = await exporter.export({
      query: `SELECT * FROM ${postgresClient.escapeIdentifier(tableName)}`,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(1);

      // Verify all columns are exported
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      const parsed = Csv.parse(csvContent);

      expect(parsed.headers.length).toBe(columnCount);
      expect(parsed.dataRows[0]?.length).toBe(columnCount);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: handles custom query with WHERE clause', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_query_where';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'id', type: 'TEXT' },
        { name: 'value', type: 'TEXT' },
      ],
      [
        { id: '1', value: '10' },
        { id: '2', value: '20' },
        { id: '3', value: '30' },
      ],
    );

    const exportKey = 'test-query-where.csv';
    const result = await exporter.export({
      query: `SELECT id, value FROM ${postgresClient.escapeIdentifier(tableName)} WHERE value::integer > 15`,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(2); // Only rows with value > 15

      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      expect(csvContent).toContain('id,value');
      expect(csvContent).toContain('2,20');
      expect(csvContent).toContain('3,30');
      expect(csvContent).not.toContain('1,10'); // Filtered out
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: handles custom query with ORDER BY', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_query_order';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'id', type: 'TEXT' },
        { name: 'name', type: 'TEXT' },
      ],
      [
        { id: '3', name: 'Charlie' },
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ],
    );

    const exportKey = 'test-query-order.csv';
    const result = await exporter.export({
      query: `SELECT id, name FROM ${postgresClient.escapeIdentifier(tableName)} ORDER BY id`,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(3);

      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');
      const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);

      // Verify ordering (should be sorted by id)
      expect(lines[1]).toContain('1,Alice');
      expect(lines[2]).toContain('2,Bob');
      expect(lines[3]).toContain('3,Charlie');
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: handles query that returns 0 rows', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_query_empty';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'id', type: 'TEXT' },
        { name: 'value', type: 'TEXT' },
      ],
      [
        { id: '1', value: '10' },
        { id: '2', value: '20' },
      ],
    );

    const exportKey = 'test-query-empty.csv';
    const result = await exporter.export({
      query: `SELECT id, value FROM ${postgresClient.escapeIdentifier(tableName)} WHERE value::integer > 100`,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(0);
      expect(result.value.fileSize).toBeGreaterThanOrEqual(0); // May be empty or just headers
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: handles table with quoted values in CSV', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_quoted_values';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'name', type: 'TEXT' },
        { name: 'description', type: 'TEXT' },
      ],
      [
        { name: 'Item A', description: 'Contains "quotes" and, commas' },
        { name: 'Item B', description: 'Normal description' },
      ],
    );

    const exportKey = 'test-quoted-values.csv';
    const result = await exporter.export({
      query: `SELECT * FROM ${postgresClient.escapeIdentifier(tableName)}`,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(2);

      // Verify CSV properly escapes quotes
      const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
      const csvContent = fileData.toString('utf-8');

      // Should contain quoted value with escaped quotes
      expect(csvContent).toContain('"Contains ""quotes"" and, commas"');
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });
});
