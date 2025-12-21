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

describe('TabularDataPostgresImporter - Error cases', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  test('import: returns error for non-existent file', async () => {
    const { importer } = fixtures;

    const result = await importer.import({
      bucket: TEST_BUCKET,
      key: 'non-existent-file.csv',
      viewName: 'test_error',
    });
    expect(isOk(result)).toBe(false);

    if (!isOk(result)) {
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
      expect(result.error).toContain('Failed to import tabular data');
    }
  });

  test('import: returns error for empty CSV content', async () => {
    const { importer, objectStore } = fixtures;

    // For truly empty content, the converter fails to detect file type first
    const emptyKey = 'test-empty-file.csv';
    await writeCsvToS3(objectStore, emptyKey, '');
    const emptyResult = await importer.import({
      bucket: TEST_BUCKET,
      key: emptyKey,
      viewName: 'test_error',
    });
    expect(isOk(emptyResult)).toBe(false);
    if (!isOk(emptyResult)) {
      expect(emptyResult.error).toBeDefined();
      // The error will be about file type detection, not empty CSV
      expect(emptyResult.error).toContain('Failed to import tabular data');
    }

    // Test with a CSV that has just a header (this should succeed with 0 rows)
    const headerOnlyKey = 'test-header-only.csv';
    await writeCsvToS3(
      objectStore,
      headerOnlyKey,
      Csv.builder([]).withHeader(['col1', 'col2']).toString(),
    );
    const headerResult = await importer.import({
      bucket: TEST_BUCKET,
      key: headerOnlyKey,
      viewName: 'test_header_only',
    });
    expect(isOk(headerResult)).toBe(true);
    if (isOk(headerResult)) {
      expect(headerResult.value.rowCount).toBe(0);
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: emptyKey });
    await objectStore.delete({ bucket: TEST_BUCKET, key: headerOnlyKey });
  });

  test('import: returns error for CSV with no columns', async () => {
    const { importer, objectStore } = fixtures;

    // For a file with no columns, the converter might fail to detect it as CSV
    // So we test with whitespace-only content that can't be detected
    const testKey = 'test-no-columns.csv';
    await writeCsvToS3(objectStore, testKey, '\n\n');

    const result = await importer.import({
      bucket: TEST_BUCKET,
      key: testKey,
      viewName: 'test_error',
    });
    expect(isOk(result)).toBe(false);

    if (!isOk(result)) {
      expect(result.error).toBeDefined();
      // The error will be about file type detection since it can't detect CSV
      expect(result.error).toContain('Failed to import tabular data');
    }

    await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
  });
});
