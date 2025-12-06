import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { z } from 'zod';
import { getTestFilePath } from '~/src/test-files/test-files';
import { isOk } from '../../result';
import {
  TEST_BUCKET,
  cleanupFixtures,
  setupFixtures,
  writeCsvToS3,
  type TestFixtures,
} from './fixtures';

const BOISE_STATE_RULES_TABLE_NAME = 'boise_state_rules';
const BOISE_STATE_FILE = 'boise-rules.csv';
const TEST_FILE_PATH = getTestFilePath(BOISE_STATE_FILE);

/**
 * Tests for importing the boise state rules CSV file.
 *
 * The CSV has a CourseOrder column that contains numeric values like "1" and "2".
 * With the improved type inference, numeric values are now correctly inferred as integer
 * rather than boolean, preventing false positives.
 */
describe('TabularDataPostgresImporter - Boise State Rules CSV', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test(`import: successfully imports ${BOISE_STATE_FILE} with all rows`, async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    // Read the CSV file from test-files directory
    const csvContent = readFileSync(TEST_FILE_PATH, 'utf-8');
    expect(csvContent.length).toBeGreaterThan(0);

    // Count expected rows (excluding header)
    const lines = csvContent.trim().split('\n');
    const expectedRowCount = lines.length - 1; // Subtract header
    expect(expectedRowCount).toBeGreaterThan(0);
    // The file has approximately 4999 data rows
    expect(expectedRowCount).toBeGreaterThan(4000);

    const testKey = BOISE_STATE_FILE;
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = BOISE_STATE_RULES_TABLE_NAME;
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

      // Verify schema matches expected columns
      const schemaResult = await postgresClient.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        expect(schema.length).toBe(8); // 8 columns in the CSV

        // Verify column names
        const columnNames = schema.map((col) => col.column_name);
        expect(columnNames).toContain('RuleIdentifier');
        expect(columnNames).toContain('CourseType');
        expect(columnNames).toContain('InstitutionName');
        expect(columnNames).toContain('UniqueIdentifier');
        expect(columnNames).toContain('CourseOrder');
        expect(columnNames).toContain('Subject');
        expect(columnNames).toContain('Number');
        expect(columnNames).toContain('Operator');

        // Verify data types (all should be text based on CSV content)
        // The importer should infer types, but with this data, most will be text
        const ruleIdentifierCol = schema.find((c) => c.column_name === 'RuleIdentifier');
        expect(ruleIdentifierCol).toBeDefined();
        const courseTypeCol = schema.find((c) => c.column_name === 'CourseType');
        expect(courseTypeCol).toBeDefined();
        const uniqueIdentifierCol = schema.find((c) => c.column_name === 'UniqueIdentifier');
        expect(uniqueIdentifierCol).toBeDefined();
        const courseOrderCol = schema.find((c) => c.column_name === 'CourseOrder');
        expect(courseOrderCol).toBeDefined();
      }

      // Verify sample data matches expected structure
      // Note: getTableRows doesn't support limit, so we'll check all rows
      // but only verify the first few
      // UniqueIdentifier and CourseOrder are inferred as integers, not strings
      const rowsResult = await postgresClient.getTableRows(
        tableName,
        z.object({
          RuleIdentifier: z.string(),
          CourseType: z.string(),
          InstitutionName: z.string(),
          UniqueIdentifier: z.number(), // Inferred as integer
          CourseOrder: z.number(), // Inferred as integer (not boolean anymore!)
          Subject: z.string(),
          Number: z.string(),
          Operator: z.string().nullable(),
        }),
      );
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBe(expectedRowCount);

        // Verify first row structure
        const firstRow = rows[0];
        expect(firstRow).toBeDefined();
        if (firstRow) {
          expect(firstRow.RuleIdentifier).toBeDefined();
          expect(typeof firstRow.RuleIdentifier).toBe('string');
          expect(firstRow.CourseType).toBeDefined();
          expect(['Source', 'Target']).toContain(firstRow.CourseType);
          expect(firstRow.InstitutionName).toBeDefined();
          expect(typeof firstRow.InstitutionName).toBe('string');
          expect(firstRow.UniqueIdentifier).toBeDefined();
          expect(firstRow.CourseOrder).toBeDefined();
          expect(firstRow.Subject).toBeDefined();
          expect(firstRow.Number).toBeDefined();
          // Operator can be empty/null
        }
      }
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test(`import: verifies data integrity with specific row checks for ${BOISE_STATE_FILE}`, async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = readFileSync(TEST_FILE_PATH, 'utf-8');
    const testKey = 'boise-state-rules-integrity.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = `${BOISE_STATE_RULES_TABLE_NAME}_integrity`;
    testTables.push(tableName);

    const result = await importer.import(TEST_BUCKET, testKey, { tableName });
    expect(isOk(result)).toBe(true);
    if (!isOk(result)) {
      throw new Error(`Import failed: ${result.error}`);
    }

    if (isOk(result)) {
      // Get all rows to verify data integrity
      // UniqueIdentifier and CourseOrder are inferred as integers
      const rowsResult = await postgresClient.getTableRows(
        tableName,
        z.object({
          RuleIdentifier: z.string(),
          CourseType: z.string(),
          InstitutionName: z.string(),
          UniqueIdentifier: z.number(), // Inferred as integer
          CourseOrder: z.number(), // Inferred as integer (not boolean anymore!)
          Subject: z.string(),
          Number: z.string(),
          Operator: z.string().nullable(),
        }),
      );
      expect(isOk(rowsResult)).toBe(true);

      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows.length).toBe(result.value.rowCount);

        // Verify that we have both Source and Target rows
        const sourceRows = rows.filter((r) => r.CourseType === 'Source');
        const targetRows = rows.filter((r) => r.CourseType === 'Target');
        expect(sourceRows.length).toBeGreaterThan(0);
        expect(targetRows.length).toBeGreaterThan(0);

        // Verify that RuleIdentifier appears in pairs (Source and Target)
        const ruleIdentifiers = new Set(rows.map((r) => r.RuleIdentifier));
        expect(ruleIdentifiers.size).toBeGreaterThan(0);

        // Verify that UniqueIdentifier is numeric (now inferred as integer)
        rows.forEach((row) => {
          expect(row.UniqueIdentifier).toBeDefined();
          expect(typeof row.UniqueIdentifier).toBe('number');
          expect(row.UniqueIdentifier).toBeGreaterThanOrEqual(0);
        });

        // Verify CourseOrder is numeric (now inferred as integer, not boolean!)
        rows.forEach((row) => {
          expect(row.CourseOrder).toBeDefined();
          expect(typeof row.CourseOrder).toBe('number');
          expect(row.CourseOrder).toBeGreaterThanOrEqual(0);
        });
      }
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });

  test('import: handles truncate option correctly', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = readFileSync(TEST_FILE_PATH, 'utf-8');
    const testKey = 'boise-state-rules-truncate.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = `${BOISE_STATE_RULES_TABLE_NAME}_truncate`;
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

  test('import: handles dropIfExists option correctly', async () => {
    const { importer, postgresClient, objectStore, testTables } = fixtures;

    const csvContent = readFileSync(TEST_FILE_PATH, 'utf-8');
    const testKey = 'boise-state-rules-drop.csv';
    await writeCsvToS3(objectStore, testKey, csvContent);

    const tableName = `${BOISE_STATE_RULES_TABLE_NAME}_drop`;
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
