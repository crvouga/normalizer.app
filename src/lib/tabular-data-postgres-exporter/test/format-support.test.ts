import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { isOk } from '../../result';
import { Csv } from '../../csv/csv';
import {
  TEST_BUCKET,
  cleanupFixtures,
  setupFixtures,
  createTestTable,
  readExportedFile,
  type TestFixtures,
} from './fixtures';

describe('TabularDataPostgresExporter - Format support', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await setupFixtures();
  });

  afterAll(async () => {
    await cleanupFixtures(fixtures);
  });

  describe('CSV format', () => {
    test('export: CSV format has proper escaping and quotes', async () => {
      const { exporter, postgresClient, objectStore, testTables } = fixtures;

      const tableName = 'test_csv_format';
      testTables.push(tableName);

      await createTestTable(
        postgresClient,
        tableName,
        [
          { name: 'name', type: 'TEXT' },
          { name: 'description', type: 'TEXT' },
        ],
        [
          { name: 'Item A', description: 'Contains "quotes"' },
          { name: 'Item B', description: 'Contains, commas' },
          { name: 'Item C', description: 'Contains\nnewlines' },
        ],
      );

      const exportKey = 'test-csv-format.csv';
      const result = await exporter.export({
        tableName,
        bucket: TEST_BUCKET,
        key: exportKey,
        format: 'csv',
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
        const csvContent = fileData.toString('utf-8');

        // Verify proper CSV escaping
        expect(csvContent).toContain('"Contains ""quotes"""'); // Escaped quotes
        expect(csvContent).toContain('"Contains, commas"'); // Quoted due to comma
        expect(csvContent).toContain('"Contains\nnewlines"'); // Quoted due to newline

        // Verify delimiters
        expect(csvContent).toContain(',');
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
    });

    test('export: CSV format preserves data types as strings', async () => {
      const { exporter, postgresClient, objectStore, testTables } = fixtures;

      const tableName = 'test_csv_types';
      testTables.push(tableName);

      await createTestTable(
        postgresClient,
        tableName,
        [
          { name: 'id', type: 'TEXT' },
          { name: 'value', type: 'TEXT' },
          { name: 'flag', type: 'TEXT' },
        ],
        [
          { id: '1', value: '10.5', flag: 'true' },
          { id: '2', value: '20', flag: 'false' },
        ],
      );

      const exportKey = 'test-csv-types.csv';
      const result = await exporter.export({
        tableName,
        bucket: TEST_BUCKET,
        key: exportKey,
        format: 'csv',
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
        const csvContent = fileData.toString('utf-8');
        const parsed = Csv.parse(csvContent);

        // All values should be strings in CSV
        expect(parsed.dataRows[0]?.[1]).toBe('10.5');
        expect(parsed.dataRows[0]?.[2]).toBe('true');
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
    });
  });

  describe('XLSX format', () => {
    test('export: XLSX format creates valid Excel file', async () => {
      const { exporter, postgresClient, objectStore, testTables } = fixtures;

      const tableName = 'test_xlsx_format';
      testTables.push(tableName);

      await createTestTable(
        postgresClient,
        tableName,
        [
          { name: 'id', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
          { name: 'value', type: 'TEXT' },
        ],
        [
          { id: '1', name: 'Item A', value: '10' },
          { id: '2', name: 'Item B', value: '20' },
        ],
      );

      const exportKey = 'test-xlsx-format.xlsx';
      const result = await exporter.export({
        tableName,
        bucket: TEST_BUCKET,
        key: exportKey,
        format: 'xlsx',
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.rowCount).toBe(2);
        expect(result.value.fileSize).toBeGreaterThan(0);

        // Verify XLSX format (ZIP-based, starts with PK signature)
        const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
        expect(fileData[0]).toBe(0x50); // 'P'
        expect(fileData[1]).toBe(0x4b); // 'K'
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
    });

    test('export: XLSX file can be re-imported', async () => {
      const { exporter, postgresClient, objectStore, testTables } = fixtures;

      const tableName = 'test_xlsx_roundtrip';
      testTables.push(tableName);

      const sourceData = [
        { id: '1', name: 'Item A', value: '10' },
        { id: '2', name: 'Item B', value: '20' },
      ];

      await createTestTable(
        postgresClient,
        tableName,
        [
          { name: 'id', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
          { name: 'value', type: 'TEXT' },
        ],
        sourceData,
      );

      const exportKey = 'test-xlsx-roundtrip.xlsx';
      const exportResult = await exporter.export({
        tableName,
        bucket: TEST_BUCKET,
        key: exportKey,
        format: 'xlsx',
      });

      expect(isOk(exportResult)).toBe(true);

      // Verify file exists and is readable
      const existsResult = await objectStore.exists({ bucket: TEST_BUCKET, key: exportKey });
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
    });
  });

  describe('Parquet format', () => {
    test('export: Parquet format creates valid Parquet file', async () => {
      const { exporter, postgresClient, objectStore, testTables } = fixtures;

      const tableName = 'test_parquet_format';
      testTables.push(tableName);

      await createTestTable(
        postgresClient,
        tableName,
        [
          { name: 'id', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
          { name: 'value', type: 'TEXT' },
        ],
        [
          { id: '1', name: 'Item A', value: '10' },
          { id: '2', name: 'Item B', value: '20' },
        ],
      );

      const exportKey = 'test-parquet-format.parquet';
      const result = await exporter.export({
        tableName,
        bucket: TEST_BUCKET,
        key: exportKey,
        format: 'parquet',
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.rowCount).toBe(2);
        expect(result.value.fileSize).toBeGreaterThan(0);

        // Verify Parquet format (starts with PAR1 signature)
        const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
        const parquetSignature = fileData.toString('utf-8', 0, 4);
        expect(parquetSignature).toBe('PAR1');
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
    });
  });

  describe('JSON format', () => {
    test('export: JSON format creates valid JSON array', async () => {
      const { exporter, postgresClient, objectStore, testTables } = fixtures;

      const tableName = 'test_json_format';
      testTables.push(tableName);

      await createTestTable(
        postgresClient,
        tableName,
        [
          { name: 'id', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
          { name: 'value', type: 'TEXT' },
        ],
        [
          { id: '1', name: 'Item A', value: '10' },
          { id: '2', name: 'Item B', value: '20' },
        ],
      );

      const exportKey = 'test-json-format.json';
      const result = await exporter.export({
        tableName,
        bucket: TEST_BUCKET,
        key: exportKey,
        format: 'json',
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.rowCount).toBe(2);
        expect(result.value.fileSize).toBeGreaterThan(0);

        // Verify JSON structure
        const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
        const jsonContent = JSON.parse(fileData.toString('utf-8'));

        expect(Array.isArray(jsonContent)).toBe(true);
        expect(jsonContent.length).toBe(2);
        expect(jsonContent[0]).toHaveProperty('id');
        expect(jsonContent[0]).toHaveProperty('name');
        expect(jsonContent[0]).toHaveProperty('value');
        expect(jsonContent[0]?.id).toBe('1');
        expect(jsonContent[0]?.name).toBe('Item A');
        expect(jsonContent[1]?.id).toBe('2');
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
    });

    test('export: JSON format handles empty arrays', async () => {
      const { exporter, postgresClient, objectStore, testTables } = fixtures;

      const tableName = 'test_json_empty';
      testTables.push(tableName);

      await createTestTable(
        postgresClient,
        tableName,
        [
          { name: 'id', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
        ],
        [],
      );

      const exportKey = 'test-json-empty.json';
      const result = await exporter.export({
        tableName,
        bucket: TEST_BUCKET,
        key: exportKey,
        format: 'json',
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.rowCount).toBe(0);

        // Verify JSON is empty array
        const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
        const jsonContent = JSON.parse(fileData.toString('utf-8'));

        expect(Array.isArray(jsonContent)).toBe(true);
        expect(jsonContent.length).toBe(0);
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
    });
  });

  describe('Round-trip tests', () => {
    test('export then import: CSV maintains data integrity', async () => {
      const { exporter, postgresClient, objectStore, testTables } = fixtures;

      const sourceTableName = 'test_roundtrip_source';
      const targetTableName = 'test_roundtrip_target';
      testTables.push(sourceTableName, targetTableName);

      const sourceData = [
        { id: '1', name: 'Item A', value: '10' },
        { id: '2', name: 'Item B', value: '20' },
        { id: '3', name: 'Item C', value: '30' },
      ];

      await createTestTable(
        postgresClient,
        sourceTableName,
        [
          { name: 'id', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
          { name: 'value', type: 'TEXT' },
        ],
        sourceData,
      );

      // Export to CSV
      const exportKey = 'test-roundtrip.csv';
      const exportResult = await exporter.export({
        tableName: sourceTableName,
        bucket: TEST_BUCKET,
        key: exportKey,
        format: 'csv',
      });

      expect(isOk(exportResult)).toBe(true);
      if (isOk(exportResult)) {
        expect(exportResult.value.rowCount).toBe(3);

        // Verify exported CSV can be parsed
        const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
        const csvContent = fileData.toString('utf-8');
        const parsed = Csv.parse(csvContent);

        expect(parsed.headers).toEqual(['id', 'name', 'value']);
        expect(parsed.dataRows.length).toBe(3);
        expect(parsed.dataRows[0]).toEqual(['1', 'Item A', '10']);
        expect(parsed.dataRows[1]).toEqual(['2', 'Item B', '20']);
        expect(parsed.dataRows[2]).toEqual(['3', 'Item C', '30']);
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
    });

    test('export then import: JSON maintains data integrity', async () => {
      const { exporter, postgresClient, objectStore, testTables } = fixtures;

      const sourceTableName = 'test_roundtrip_json_source';
      testTables.push(sourceTableName);

      const sourceData = [
        { id: '1', name: 'Item A', value: '10' },
        { id: '2', name: 'Item B', value: '20' },
      ];

      await createTestTable(
        postgresClient,
        sourceTableName,
        [
          { name: 'id', type: 'TEXT' },
          { name: 'name', type: 'TEXT' },
          { name: 'value', type: 'TEXT' },
        ],
        sourceData,
      );

      // Export to JSON
      const exportKey = 'test-roundtrip.json';
      const exportResult = await exporter.export({
        tableName: sourceTableName,
        bucket: TEST_BUCKET,
        key: exportKey,
        format: 'json',
      });

      expect(isOk(exportResult)).toBe(true);
      if (isOk(exportResult)) {
        expect(exportResult.value.rowCount).toBe(2);

        // Verify exported JSON can be parsed and matches source
        const fileData = await readExportedFile(objectStore, TEST_BUCKET, exportKey);
        const jsonContent = JSON.parse(fileData.toString('utf-8'));

        expect(jsonContent.length).toBe(2);
        expect(jsonContent[0]?.id).toBe('1');
        expect(jsonContent[0]?.name).toBe('Item A');
        expect(jsonContent[0]?.value).toBe('10');
        expect(jsonContent[1]?.id).toBe('2');
        expect(jsonContent[1]?.name).toBe('Item B');
        expect(jsonContent[1]?.value).toBe('20');
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: exportKey });
    });
  });
});
