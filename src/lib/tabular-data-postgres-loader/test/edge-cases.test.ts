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

describe('TabularDataPostgresImporter - Edge cases', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('import: handles empty CSV file (creates table with schema, 0 rows)', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = Csv.of([]).withHeader(['name', 'age', 'city']).toString(); // Empty rows, header only

    const testKey = 'test-empty.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test_empty';
    testTables.push(tableName);

    const result = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.rowCount).toBe(0);

      // Verify table exists with schema
      const existsResult = await postgresClient.tableExists(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      const schemaResult = await postgresClient.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        expect(schema.length).toBe(3);
        expect(schema[0]!.column_name).toBe('name');
        expect(schema[1]!.column_name).toBe('age');
        expect(schema[2]!.column_name).toBe('city');
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test('import: handles CSV with only headers (no data rows)', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = Csv.of([]).withHeader(['col1', 'col2', 'col3']).toString();

    const testKey = 'test-headers-only.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test_headers_only';
    testTables.push(tableName);

    const result = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.rowCount).toBe(0);

      const schemaResult = await postgresClient.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        expect(schemaResult.value.length).toBe(3);
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test('import: sanitizes table and column names with special characters', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    // Use unique column names that won't collide when sanitized
    // col-with-dash -> col_with_dash, col_with_underscore stays the same
    // But to be safe, use completely different base names
    const header = [
      'col-dash-1',
      'col_underscore_2',
      '123col',
      'very-long-column-name-that-exceeds-sixty-three-characters-should-be-truncated',
    ];
    const csvContent = Csv.of([
      {
        'col-dash-1': 'value1',
        col_underscore_2: 'value2',
        '123col': 'value3',
        'very-long-column-name-that-exceeds-sixty-three-characters-should-be-truncated': 'value4',
      },
    ])
      .withHeader(header)
      .toString();

    // Use unique key to avoid cache issues
    const testKey = `test-sanitize-${Date.now()}.csv`;
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test-table@with#special$chars!';
    testTables.push('test_table_with_special_chars_'); // Sanitized version

    const result = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      // Table name should be sanitized
      const sanitizedTableName = result.value.tableName;
      expect(sanitizedTableName).not.toContain('@');
      expect(sanitizedTableName).not.toContain('#');
      expect(sanitizedTableName).not.toContain('$');
      expect(sanitizedTableName).not.toContain('!');

      // Verify table exists
      const existsResult = await postgresClient.tableExists(sanitizedTableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      // Column names should be sanitized
      const schemaResult = await postgresClient.getTableSchema(sanitizedTableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        expect(schema.length).toBe(4);
        // col-dash-1 should become col_dash_1
        const colDash = schema.find((c) => c.column_name === 'col_dash_1');
        expect(colDash).toBeDefined();
        // col_underscore_2 should stay col_underscore_2
        const colUnderscore = schema.find((c) => c.column_name === 'col_underscore_2');
        expect(colUnderscore).toBeDefined();
        // 123col should become _123col
        const col123 = schema.find((c) => c.column_name === '_123col');
        expect(col123).toBeDefined();
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test('import: handles table names starting with numbers', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = Csv.of([{ name: 'Test', value: 100 }]).toString();

    const testKey = 'test-number-start.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = '123table';
    testTables.push('_123table'); // Sanitized version

    const result = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      // Table name should start with underscore
      expect(result.value.tableName).toMatch(/^_/);
      const existsResult = await postgresClient.tableExists(result.value.tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test('import: truncates long table names to 63 characters', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = Csv.of([{ col1: 'value1', col2: 'value2' }]).toString();

    const testKey = 'test-long-name.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const longTableName = 'a'.repeat(100); // 100 characters
    testTables.push('a'.repeat(63)); // Truncated version

    const result = await importer.import(TEST_BUCKET, testKey, { tableName: longTableName });
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.tableName.length).toBeLessThanOrEqual(63);
      const existsResult = await postgresClient.tableExists(result.value.tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });
});
