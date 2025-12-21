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

describe('TabularDataPostgresImporter - Data types', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('import: handles all column types as TEXT', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = Csv.builder([
      {
        text_col: 'Hello',
        integer_col: 42,
        numeric_col: 3.14,
        date_col: '2024-01-15',
        timestamp_col: '2024-01-15 10:30:00',
      },
      {
        text_col: 'World',
        integer_col: 100,
        numeric_col: 99.99,
        date_col: '2024-02-20',
        timestamp_col: '2024-02-20 15:45:30',
      },
    ]).toString();

    // Use unique key with timestamp to avoid cache issues
    const testKey = `test-all-types-${Date.now()}.csv`;
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test_all_types';
    testTables.push(tableName);

    const result = await importer.import({
      bucket: TEST_BUCKET,
      key: testKey,
      viewName: tableName,
    });
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.rowCount).toBe(2);

      const schemaResult = await postgresClient.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        expect(schema.length).toBe(5);
        // All columns should be TEXT type
        const textCol = schema.find((c) => c.column_name === 'text_col');
        expect(textCol?.data_type).toBe('text');
        const integerCol = schema.find((c) => c.column_name === 'integer_col');
        expect(integerCol?.data_type).toBe('text');
        const numericCol = schema.find((c) => c.column_name === 'numeric_col');
        expect(numericCol?.data_type).toBe('text');
        const dateCol = schema.find((c) => c.column_name === 'date_col');
        expect(dateCol?.data_type).toBe('text');
        const timestampCol = schema.find((c) => c.column_name === 'timestamp_col');
        expect(timestampCol?.data_type).toBe('text');
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test('import: handles nullable columns', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = Csv.builder([
      { name: 'Alice', age: 30, email: null },
      { name: 'Bob', age: null, email: 'bob@example.com' },
      { name: 'Charlie', age: 25, email: 'charlie@example.com' },
    ]).toString();

    const testKey = 'test-nullable.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test_nullable';
    testTables.push(tableName);

    const result = await importer.import({
      bucket: TEST_BUCKET,
      key: testKey,
      viewName: tableName,
    });
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      const rowsResult = await postgresClient.getTableRows(
        tableName,
        z.object({
          name: z.string(),
          age: z.string().nullable(), // TEXT type
          email: z.string().nullable(),
        }),
      );
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows.length).toBe(3);
        expect(rows[0]?.email).toBeNull();
        expect(rows[1]?.age).toBeNull();
        expect(rows[2]?.age).toBe('25'); // String now
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });
});
