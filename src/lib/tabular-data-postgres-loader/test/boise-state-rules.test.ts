import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  BOISE_RULES_FILE_NAME,
  BOISE_RULES_TABLE_NAME,
  BOISE_RULES_TABLE_NAMES,
  createBoiseRulesSchemaFromHeaders,
  extractCsvHeaders,
  getExpectedRowCount,
  loadBoiseRulesFile,
} from '~/src/test-files/boise-rules';
import { isOk } from '../../result';
import {
  TEST_BUCKET,
  cleanupFixtures,
  setupFixtures,
  writeCsvToS3,
  type TestFixtures,
} from './fixtures';

describe('TabularDataPostgresImporter - Boise Rules CSV', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test(`import: successfully imports ${BOISE_RULES_FILE_NAME} with all rows`, async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    // Load the CSV file using the boise-rules module
    const csvContent = loadBoiseRulesFile();
    expect(csvContent.length).toBeGreaterThan(0);

    // Get expected row count using utility function
    const expectedRowCount = getExpectedRowCount(csvContent);
    expect(expectedRowCount).toBeGreaterThan(0);
    // The file has approximately 266,000+ data rows
    expect(expectedRowCount).toBeGreaterThan(200000);

    // Get CSV schema from header
    const headerColumns = extractCsvHeaders(csvContent);

    const testKey = BOISE_RULES_FILE_NAME;
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = BOISE_RULES_TABLE_NAME;
    testTables.push(tableName);

    const result = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) {
      throw new Error(`Import failed: ${result.error}`);
    }

    if (isOk(result)) {
      expect(result.value.tableName).toBe(tableName);
      expect(result.value.rowCount).toBe(expectedRowCount);

      // Verify table exists
      const existsResult = await postgresClient.tableExists(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      // Verify row count matches
      const rowCountResult = await postgresClient.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(expectedRowCount);
      }

      // Verify schema matches expected columns (exact match with the CSV!)
      const schemaResult = await postgresClient.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        const columnNames = schema.map((col) => col.column_name);

        // All columns in CSV header should be present (case sensitive)
        expect(columnNames).toEqual(headerColumns);

        // All columns should be "text" (by default in CSV import)
        for (const col of schema) {
          expect(col.data_type).toMatch(/text/i);
        }
      }

      // Verify sample data matches expected structure
      // Build zod schema matching the CSV columns using the utility function
      const zodSchema = createBoiseRulesSchemaFromHeaders(headerColumns);

      const rowsResult = await postgresClient.getTableRows(tableName, zodSchema);
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBe(expectedRowCount);

        // Check that all fields are present in the first row
        const firstRow = rows[0];
        expect(firstRow).toBeDefined();
        if (firstRow) {
          for (const key of headerColumns) {
            expect(key in firstRow).toBe(true);
            expect(typeof firstRow[key]).toBe('string');
          }
        }
      }
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test(`import: verifies data integrity with specific row checks for ${BOISE_RULES_FILE_NAME}`, async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = loadBoiseRulesFile();
    const headerColumns = extractCsvHeaders(csvContent);

    const testKey = 'boise-rules-integrity.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = BOISE_RULES_TABLE_NAMES.INTEGRITY;
    testTables.push(tableName);

    const result = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) {
      throw new Error(`Import failed: ${result.error}`);
    }

    if (isOk(result)) {
      // Get all rows to verify data integrity
      const zodSchema = createBoiseRulesSchemaFromHeaders(headerColumns);

      const rowsResult = await postgresClient.getTableRows(tableName, zodSchema);
      expect(isOk(rowsResult)).toBe(true);

      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows.length).toBe(result.value.rowCount);

        // Verify first and last row have correct string fields filled
        const firstRow = rows[0];
        const lastRow = rows[rows.length - 1];
        for (const key of headerColumns) {
          expect(typeof firstRow?.[key]).toBe('string');
          expect(typeof lastRow?.[key]).toBe('string');
        }

        // Check that critical information columns are non-empty
        // First column should be SendInstitution
        expect(firstRow?.[headerColumns[0] ?? '']?.length).toBeGreaterThan(0);
        // 8th column should be SendCourse1CourseCode
        expect(firstRow?.[headerColumns[7] ?? '']?.length).toBeGreaterThan(0);

        expect(lastRow?.[headerColumns[0] ?? '']?.length).toBeGreaterThan(0);
        expect(lastRow?.[headerColumns[7] ?? '']?.length).toBeGreaterThan(0);
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test(`import: handles truncate option correctly for ${BOISE_RULES_FILE_NAME}`, async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = loadBoiseRulesFile();

    const testKey = 'boise-rules-truncate.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = BOISE_RULES_TABLE_NAMES.TRUNCATE;
    testTables.push(tableName);

    // First import
    const result1 = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result1)).toBe(true);
    if (!isOk(result1)) {
      throw new Error(`Import failed: ${result1.error}`);
    }
    if (isOk(result1)) {
      expect(result1.value.rowCount).toBeGreaterThan(0);
    }

    // Second import with truncate
    const result2 = await importer.import(TEST_BUCKET, testKey, {
      tableName,
      truncate: true,
    });
    expect(isOk(result2)).toBe(true);
    if (isOk(result2)) {
      expect(result2.value.rowCount).toBe(result1.value.rowCount);
    }

    // Verify row count matches
    const rowCountResult = await postgresClient.getTableRowCount(tableName);
    expect(isOk(rowCountResult)).toBe(true);
    if (isOk(rowCountResult) && isOk(result1)) {
      expect(rowCountResult.value).toBe(result1.value.rowCount);
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test(`import: handles dropIfExists option correctly for ${BOISE_RULES_FILE_NAME}`, async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = loadBoiseRulesFile();

    const testKey = 'boise-rules-drop.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = BOISE_RULES_TABLE_NAMES.DROP;
    testTables.push(tableName);

    // First import
    const result1 = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result1)).toBe(true);
    if (!isOk(result1)) {
      throw new Error(`Import failed: ${result1.error}`);
    }

    // Second import with dropIfExists
    const result2 = await importer.import(TEST_BUCKET, testKey, {
      tableName,
      dropIfExists: true,
    });
    expect(isOk(result2)).toBe(true);
    if (isOk(result2) && isOk(result1)) {
      expect(result2.value.rowCount).toBe(result1.value.rowCount);
    }

    // Verify table still exists and has correct row count
    const existsResult = await postgresClient.tableExists(tableName);
    expect(isOk(existsResult)).toBe(true);
    if (isOk(existsResult)) {
      expect(existsResult.value).toBe(true);
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });
});
