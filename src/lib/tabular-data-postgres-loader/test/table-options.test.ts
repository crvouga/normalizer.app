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

describe('TabularDataPostgresImporter - Table options', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('import: dropIfExists option drops and recreates table', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent1 = Csv.of([
      { col1: 'A', col2: 1 },
      { col1: 'B', col2: 2 },
    ]).toString();

    const csvContent2 = Csv.of([
      { col1: 'X', col2: 10, col3: 100 },
      { col1: 'Y', col2: 20, col3: 200 },
    ]).toString();

    const testKey = 'test-drop.csv';
    await writeCsvToS3(objectStore, testKey, csvContent1);

    const tableName = 'test_drop_exists';
    testTables.push(tableName);

    // First import
    const result1 = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result1)).toBe(true);
    if (isOk(result1)) {
      expect(result1.value.rowCount).toBe(2);
    }

    // Verify initial schema
    let schemaResult = await postgresClient.getTableSchema(tableName);
    expect(isOk(schemaResult)).toBe(true);
    if (isOk(schemaResult)) {
      expect(schemaResult.value.length).toBe(2);
    }

    // Update CSV and import with dropIfExists
    // Use a different key to avoid cache issues with TabularDataConverter
    const testKey2 = 'test-drop-2.csv';
    await writeCsvToS3(objectStore, testKey2, csvContent2);
    const result2 = await importer.import(TEST_BUCKET, testKey2, {
      tableName,
      dropIfExists: true,
    });
    expect(isOk(result2)).toBe(true);

    if (isOk(result2)) {
      expect(result2.value.rowCount).toBe(2);

      // Verify new schema (should have 3 columns now)
      schemaResult = await postgresClient.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        expect(schema.length).toBe(3);
        expect(schema.find((c) => c.column_name === 'col3')).toBeDefined();
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey2 });
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test('import: truncate option clears table before insert', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = Csv.of([
      { name: 'First', value: 1 },
      { name: 'Second', value: 2 },
    ]).toString();

    const testKey = 'test-truncate.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test_truncate';
    testTables.push(tableName);

    // First import
    const result1 = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result1)).toBe(true);
    if (isOk(result1)) {
      expect(result1.value.rowCount).toBe(2);
    }

    // Load again with truncate
    const result2 = await importer.import(TEST_BUCKET, testKey, {
      tableName,
      truncate: true,
    });
    expect(isOk(result2)).toBe(true);

    if (isOk(result2)) {
      expect(result2.value.rowCount).toBe(2);

      // Verify row count is still 2 (not 4)
      const rowCountResult = await postgresClient.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(2);
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test('import: uses existing table when it already exists', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = Csv.of([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]).toString();

    const testKey = 'test-existing.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test_existing';
    testTables.push(tableName);

    // First import
    const result1 = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result1)).toBe(true);

    // Load again without dropIfExists (should fail if schema doesn't match, or append)
    // Since we're using the same CSV, it should work
    const result2 = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result2)).toBe(true);

    if (isOk(result2)) {
      // Should have 4 rows now (2 + 2)
      const rowCountResult = await postgresClient.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(4);
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });
});
