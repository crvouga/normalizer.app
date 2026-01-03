import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { isOk } from '../../result';
import { Csv } from '../../csv/csv';
import {
  TEST_BUCKET,
  cleanupFixtures,
  setupFixtures,
  writeCsvToS3,
  type TestFixtures,
} from './fixtures';

describe('TabularDataPostgresImporter - Basic functionality', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('import: successfully imports CSV with simple data', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = Csv.builder([
      { name: 'Alice', age: 30, city: 'New York' },
      { name: 'Bob', age: 25, city: 'San Francisco' },
      { name: 'Charlie', age: 35, city: 'Chicago' },
    ]).toString();

    const testKey = 'test-simple.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test_simple_table';
    testTables.push(tableName);

    const result = await importer.import({
      bucket: TEST_BUCKET,
      key: testKey,
      viewName: tableName,
    });
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.tableName).toBe(tableName);
      expect(result.value.rowCount).toBe(3);

      // Verify table exists
      const existsResult = await postgresClient.viewExist(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      // Verify row count
      const rowCountResult = await postgresClient.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(3);
      }

      // Verify schema
      const schemaResult = await postgresClient.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        expect(schema.length).toBe(3);
        expect(schema[0]!.column_name).toBe('name');
        expect(schema[0]!.data_type).toBe('text');
        expect(schema[1]!.column_name).toBe('age');
        expect(schema[1]!.data_type).toBe('text'); // All columns are TEXT
        expect(schema[2]!.column_name).toBe('city');
        expect(schema[2]!.data_type).toBe('text');
      }

      // Verify data
      const rowsResult = await postgresClient.getTableRows(
        tableName,
        z.object({
          name: z.string(),
          age: z.string(), // TEXT type
          city: z.string(),
        }),
      );
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows.length).toBe(3);
        expect(rows[0]?.name).toBe('Alice');
        expect(rows[0]?.age).toBe('30'); // String now
        expect(rows[1]?.name).toBe('Bob');
        expect(rows[1]?.age).toBe('25'); // String now
      }
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test('import: verifies table creation with correct schema', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = Csv.builder([
      { id: 1, name: 'Item A', value: 10.5 },
      { id: 2, name: 'Item B', value: 20.75 },
    ]).toString();

    const testKey = 'test-schema.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test_schema_table';
    testTables.push(tableName);

    const result = await importer.import({
      bucket: TEST_BUCKET,
      key: testKey,
      viewName: tableName,
    });
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      const schemaResult = await postgresClient.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        expect(schema.length).toBe(3);
        expect(schema[0]!.column_name).toBe('id');
        expect(schema[0]!.data_type).toBe('text'); // All columns are TEXT
        expect(schema[1]!.column_name).toBe('name');
        expect(schema[1]!.data_type).toBe('text');
        expect(schema[2]!.column_name).toBe('value');
        expect(schema[2]!.data_type).toBe('text'); // All columns are TEXT
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });
});
