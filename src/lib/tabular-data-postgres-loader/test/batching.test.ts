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

describe('TabularDataPostgresImporter - Batching', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('import: handles large dataset with batching (>5000 rows)', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    // Generate CSV with 6000 rows to test batching
    const arr = [];
    for (let i = 1; i <= 6000; i++) {
      arr.push({ id: i, name: `Item${i}`, value: i * 10 });
    }
    const csvContent = Csv.of(arr).toString();

    const testKey = 'test-large.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = 'test_large';
    testTables.push(tableName);

    const result = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result)).toBe(true);

    if (isOk(result)) {
      expect(result.value.rowCount).toBe(6000);

      // Verify all rows were inserted
      const rowCountResult = await postgresClient.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(6000);
      }

      // Verify a few specific rows exist (ORDER BY sorts strings lexicographically, not numerically)
      const rowsResult = await postgresClient.getTableRows(
        tableName,
        z.object({
          id: z.string(), // TEXT type
          name: z.string(),
          value: z.string(), // TEXT type
        }),
      );
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows.length).toBe(6000);

        // Verify specific rows exist (not checking order since ORDER BY sorts strings)
        const row1 = rows.find((r) => r.id === '1');
        expect(row1).toBeDefined();
        expect(row1?.name).toBe('Item1');
        expect(row1?.value).toBe('10');

        const row6000 = rows.find((r) => r.id === '6000');
        expect(row6000).toBeDefined();
        expect(row6000?.name).toBe('Item6000');
        expect(row6000?.value).toBe('60000');
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });
});
