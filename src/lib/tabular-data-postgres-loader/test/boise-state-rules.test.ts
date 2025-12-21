import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import {
  BOISE_RULES_FILE_NAME,
  BOISE_RULES_FILE_PATH,
  BOISE_RULES_TABLE_NAME,
  getExpectedRowCountFast,
  getHeadersOnly,
} from '~/src/test-files/boise-rules';
import { isOk } from '../../result';
import {
  TEST_BUCKET,
  cleanupFixtures,
  setupFixtures,
  writeCsvToS3,
  type TestFixtures,
} from './fixtures';

const TIMEOUT = Infinity;

describe('TabularDataPostgresImporter - Boise Rules CSV', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test(
    `import: successfully imports ${BOISE_RULES_FILE_NAME} with streaming optimizations`,
    async () => {
      const { importer, postgresClient, objectStore, testTables } = fixtures;

      // Get expected values efficiently without loading entire file
      const expectedHeaders = getHeadersOnly();
      expect(expectedHeaders.length).toBeGreaterThan(0);

      const expectedRowCount = getExpectedRowCountFast();
      expect(expectedRowCount).toBeGreaterThan(0);
      expect(expectedRowCount).toBeGreaterThan(200000); // Verify it's the large file

      // Load and upload the CSV file to S3
      // Note: We still need to load for S3 upload, but this is unavoidable for the test
      const csvPath = BOISE_RULES_FILE_PATH;
      const csvContent = readFileSync(csvPath, 'utf-8');

      const testKey = BOISE_RULES_FILE_NAME;
      await writeCsvToS3(objectStore, testKey, csvContent);

      const tableName = BOISE_RULES_TABLE_NAME;
      testTables.push(tableName);

      // Import using optimized streaming path
      const result = await importer.import(TEST_BUCKET, testKey, { viewName: tableName });
      expect(isOk(result)).toBe(true);
      if (!isOk(result)) {
        throw new Error(`Import failed: ${result.error}`);
      }

      // Verify basic import results
      expect(result.value.tableName).toBe(tableName);
      expect(result.value.rowCount).toBe(expectedRowCount);

      // Verify table exists
      const existsResult = await postgresClient.tableExists(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      // Verify row count matches (lightweight check)
      const rowCountResult = await postgresClient.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(expectedRowCount);
      }

      // Verify schema has correct columns (lightweight check, no data fetch)
      const schemaResult = await postgresClient.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        const columnNames = schema.map((col) => col.column_name);

        // Verify column count matches
        expect(columnNames.length).toBe(expectedHeaders.length);

        // All columns should be "text" (by default in CSV import)
        for (const col of schema) {
          expect(col.data_type).toMatch(/text/i);
        }
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    },
    { timeout: TIMEOUT },
  );
});
