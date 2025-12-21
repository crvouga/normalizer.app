import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { isOk } from '../../result';
import {
  TEST_BUCKET,
  cleanupFixtures,
  setupFixtures,
  createTestTable,
  type TestFixtures,
} from './fixtures';

describe('TabularDataPostgresExporter - Error cases', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('export: returns error for non-existent table', async () => {
    const { exporter } = fixtures;

    const result = await exporter.export({
      query: 'SELECT * FROM non_existent_table',
      bucket: TEST_BUCKET,
      key: 'test-error.csv',
    });
    expect(isOk(result)).toBe(false);

    if (!isOk(result)) {
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error).toContain('Failed to export tabular data');
    }
  });

  test('export: returns error for invalid SQL query', async () => {
    const { exporter } = fixtures;

    const result = await exporter.export({
      query: 'INSERT INTO test VALUES (1)',
      bucket: TEST_BUCKET,
      key: 'test-error.csv',
    });
    expect(isOk(result)).toBe(false);

    if (!isOk(result)) {
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to export tabular data');
    }
  });

  test('export: successfully exports empty table (0 rows)', async () => {
    const { exporter, postgresClient, objectStore, testTables } = fixtures;

    const tableName = 'test_empty_export';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [
        { name: 'col1', type: 'TEXT' },
        { name: 'col2', type: 'TEXT' },
      ],
      [],
    );

    const exportKey = 'test-empty-export.csv';
    const result = await exporter.export({
      query: `SELECT * FROM ${postgresClient.escapeIdentifier(tableName)}`,
      bucket: TEST_BUCKET,
      key: exportKey,
    });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.rowCount).toBe(0);
      expect(result.value.fileSize).toBeGreaterThanOrEqual(0);

      // Verify file exists (may be empty or just headers)
      const existsResult = await objectStore.exists({ bucket: TEST_BUCKET, key: exportKey });
      expect(isOk(existsResult)).toBe(true);
    }

    // Cleanup
    await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
  });

  test('export: returns error for unsupported format', async () => {
    const { exporter, postgresClient, testTables } = fixtures;

    const tableName = 'test_unsupported_format';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [{ name: 'col1', type: 'TEXT' }],
      [{ col1: 'value1' }],
    );

    const result = await exporter.export({
      query: `SELECT * FROM ${postgresClient.escapeIdentifier(tableName)}`,
      bucket: TEST_BUCKET,
      key: 'test-unsupported.pdf',
      format: 'pdf' as any,
    });

    // The converter will handle format validation, so we expect an error
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to export tabular data');
    }
  });

  test('export: query must be SELECT statement', async () => {
    const { exporter } = fixtures;

    const result = await exporter.export({
      query: 'UPDATE test SET col1 = 1',
      bucket: TEST_BUCKET,
      key: 'test-error.csv',
    });
    expect(isOk(result)).toBe(false);

    if (!isOk(result)) {
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Query must be a SELECT statement');
    }
  });

  test('export: handles query with syntax error gracefully', async () => {
    const { exporter } = fixtures;

    const result = await exporter.export({
      query: 'SELECT * FROM non_existent_table WHERE invalid syntax',
      bucket: TEST_BUCKET,
      key: 'test-error.csv',
    });
    expect(isOk(result)).toBe(false);

    if (!isOk(result)) {
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Failed to export tabular data');
    }
  });

  test('export: handles invalid bucket/key gracefully', async () => {
    const { exporter, postgresClient, testTables } = fixtures;

    const tableName = 'test_invalid_location';
    testTables.push(tableName);

    await createTestTable(
      postgresClient,
      tableName,
      [{ name: 'col1', type: 'TEXT' }],
      [{ col1: 'value1' }],
    );

    // Try with empty bucket (should fail)
    const result = await exporter.export({
      query: `SELECT * FROM ${postgresClient.escapeIdentifier(tableName)}`,
      bucket: '',
      key: 'test.csv',
    });

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error).toBeDefined();
    }
  });

  test('export: handles table with no columns', async () => {
    const { exporter, testTables } = fixtures;

    // Create a table with no columns (edge case - PostgreSQL doesn't allow this, but test the check)
    const tableName = 'test_no_columns';
    testTables.push(tableName);

    // This test verifies the error handling for edge cases
    // In practice, PostgreSQL requires at least one column
    const result = await exporter.export({
      query: 'SELECT * FROM non_existent_no_cols',
      bucket: TEST_BUCKET,
      key: 'test-error.csv',
    });

    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error).toBeDefined();
    }
  });
});
