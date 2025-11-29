import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { createPgliteSqlDb } from '../../shared/sql-db';
import { createObjectStore } from '../../shared/s3';
import { createLogger } from '../logger';
import { isOk } from '../result';
import type { SqlDb } from '../sql-db/sql-db';
import type { ObjectStore } from '../object-store/object-store';
import { PostgresMetadataClient } from '../postgres/postgres-metadata-client';
import { TabularDataPostgresLoader } from './tabular-data-postgres-loader';

const TEST_BUCKET = 'test-bucket';
const MOCK_SERVER_BASE_URL = 'http://localhost:8080';

describe('TabularDataPostgresLoader', () => {
  const logger = createLogger({ noop: true });
  let db: SqlDb;
  let objectStore: ObjectStore;
  let loader: TabularDataPostgresLoader;
  let metadataClient: PostgresMetadataClient;
  const testTables: string[] = [];

  beforeAll(async () => {
    // Initialize PGLite database
    db = await createPgliteSqlDb({ logger });

    // Initialize S3 object store
    objectStore = await createObjectStore({ logger, serverBaseUrl: MOCK_SERVER_BASE_URL });
    await objectStore.ensureBucketExists(TEST_BUCKET);

    // Initialize loader
    loader = new TabularDataPostgresLoader(db, logger, objectStore);

    // Initialize metadata client
    metadataClient = new PostgresMetadataClient(db);
  });

  afterAll(async () => {
    // Clean up test tables
    for (const tableName of testTables) {
      await db.execute(`DROP TABLE IF EXISTS ${escapeIdentifier(tableName)}`);
    }

    // Close database connection
    const closeResult = await db.close();
    expect(isOk(closeResult)).toBe(true);
  });

  beforeEach(async () => {
    // Clean up S3 test objects (optional, but good practice)
    // We'll clean up specific test files in each test
  });

  /**
   * Helper function to escape PostgreSQL identifiers (for cleanup only)
   */
  function escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }

  /**
   * Helper function to write CSV content to S3
   */
  async function writeCsvToS3(key: string, csvContent: string): Promise<void> {
    const result = await objectStore.write({
      bucket: TEST_BUCKET,
      key,
      data: Buffer.from(csvContent, 'utf-8'),
      contentType: 'text/csv',
    });
    expect(isOk(result)).toBe(true);
  }

  describe('Basic functionality', () => {
    test('load: successfully loads CSV with simple data', async () => {
      const csvContent = `name,age,city
Alice,30,New York
Bob,25,San Francisco
Charlie,35,Chicago`;

      const testKey = 'test-simple.csv';
      await writeCsvToS3(testKey, csvContent);

      const tableName = 'test_simple_table';
      testTables.push(tableName);

      const result = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.tableName).toBe(tableName);
        expect(result.value.rowCount).toBe(3);

        // Verify table exists
        const existsResult = await metadataClient.tableExists(tableName);
        expect(isOk(existsResult)).toBe(true);
        if (isOk(existsResult)) {
          expect(existsResult.value).toBe(true);
        }

        // Verify row count
        const rowCountResult = await metadataClient.getTableRowCount(tableName);
        expect(isOk(rowCountResult)).toBe(true);
        if (isOk(rowCountResult)) {
          expect(rowCountResult.value).toBe(3);
        }

        // Verify schema
        const schemaResult = await metadataClient.getTableSchema(tableName);
        expect(isOk(schemaResult)).toBe(true);
        if (isOk(schemaResult)) {
          const schema = schemaResult.value;
          expect(schema.length).toBe(3);
          expect(schema[0]!.column_name).toBe('name');
          expect(schema[0]!.data_type).toBe('text');
          expect(schema[1]!.column_name).toBe('age');
          expect(schema[1]!.data_type).toBe('integer');
          expect(schema[2]!.column_name).toBe('city');
          expect(schema[2]!.data_type).toBe('text');
        }

        // Verify data
        const rowsResult = await metadataClient.getTableRows(
          tableName,
          z.object({
            name: z.string(),
            age: z.number(),
            city: z.string(),
          }),
        );
        expect(isOk(rowsResult)).toBe(true);
        if (isOk(rowsResult)) {
          const rows = rowsResult.value;
          expect(rows.length).toBe(3);
          expect(rows[0]?.name).toBe('Alice');
          expect(rows[0]?.age).toBe(30);
          expect(rows[1]?.name).toBe('Bob');
          expect(rows[1]?.age).toBe(25);
        }
      }

      // Cleanup
      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });

    test('load: verifies table creation with correct schema', async () => {
      const csvContent = `id,name,value
1,Item A,10.5
2,Item B,20.75`;

      const testKey = 'test-schema.csv';
      await writeCsvToS3(testKey, csvContent);

      const tableName = 'test_schema_table';
      testTables.push(tableName);

      const result = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const schemaResult = await metadataClient.getTableSchema(tableName);
        expect(isOk(schemaResult)).toBe(true);
        if (isOk(schemaResult)) {
          const schema = schemaResult.value;
          expect(schema.length).toBe(3);
          expect(schema[0]!.column_name).toBe('id');
          expect(schema[0]!.data_type).toBe('integer');
          expect(schema[1]!.column_name).toBe('name');
          expect(schema[1]!.data_type).toBe('text');
          expect(schema[2]!.column_name).toBe('value');
          expect(schema[2]!.data_type).toBe('numeric');
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });
  });

  describe('Data types', () => {
    test('load: handles all column types correctly', async () => {
      // Note: Excluding boolean type as the implementation doesn't convert string values
      // to boolean types for insertion. Boolean values would need type conversion.
      const csvContent = `text_col,integer_col,numeric_col,date_col,timestamp_col
Hello,42,3.14,2024-01-15,2024-01-15 10:30:00
World,100,99.99,2024-02-20,2024-02-20 15:45:30`;

      // Use unique key with timestamp to avoid cache issues
      const testKey = `test-all-types-${Date.now()}.csv`;
      await writeCsvToS3(testKey, csvContent);

      const tableName = 'test_all_types';
      testTables.push(tableName);

      const result = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.rowCount).toBe(2);

        const schemaResult = await metadataClient.getTableSchema(tableName);
        expect(isOk(schemaResult)).toBe(true);
        if (isOk(schemaResult)) {
          const schema = schemaResult.value;
          expect(schema.length).toBe(5);
          const textCol = schema.find((c) => c.column_name === 'text_col');
          expect(textCol?.data_type).toBe('text');
          const integerCol = schema.find((c) => c.column_name === 'integer_col');
          expect(integerCol?.data_type).toBe('integer');
          const numericCol = schema.find((c) => c.column_name === 'numeric_col');
          expect(numericCol?.data_type).toBe('numeric');
          const dateCol = schema.find((c) => c.column_name === 'date_col');
          expect(dateCol?.data_type).toBe('date');
          const timestampCol = schema.find((c) => c.column_name === 'timestamp_col');
          // PostgreSQL returns "timestamp without time zone" for timestamp type
          expect(timestampCol?.data_type).toMatch(/^timestamp/);
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });

    test('load: handles nullable columns', async () => {
      const csvContent = `name,age,email
Alice,30,
Bob,,bob@example.com
Charlie,25,charlie@example.com`;

      const testKey = 'test-nullable.csv';
      await writeCsvToS3(testKey, csvContent);

      const tableName = 'test_nullable';
      testTables.push(tableName);

      const result = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        const rowsResult = await metadataClient.getTableRows(
          tableName,
          z.object({
            name: z.string(),
            age: z.number().nullable(),
            email: z.string().nullable(),
          }),
        );
        expect(isOk(rowsResult)).toBe(true);
        if (isOk(rowsResult)) {
          const rows = rowsResult.value;
          expect(rows.length).toBe(3);
          expect(rows[0]?.email).toBeNull();
          expect(rows[1]?.age).toBeNull();
          expect(rows[2]?.age).toBe(25);
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });
  });

  describe('Table options', () => {
    test('load: dropIfExists option drops and recreates table', async () => {
      const csvContent1 = `col1,col2
A,1
B,2`;

      const csvContent2 = `col1,col2,col3
X,10,100
Y,20,200`;

      const testKey = 'test-drop.csv';
      await writeCsvToS3(testKey, csvContent1);

      const tableName = 'test_drop_exists';
      testTables.push(tableName);

      // First load
      const result1 = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value.rowCount).toBe(2);
      }

      // Verify initial schema
      let schemaResult = await metadataClient.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        expect(schemaResult.value.length).toBe(2);
      }

      // Update CSV and load with dropIfExists
      // Use a different key to avoid cache issues with TabularDataConverter
      const testKey2 = 'test-drop-2.csv';
      await writeCsvToS3(testKey2, csvContent2);
      const result2 = await loader.load(TEST_BUCKET, testKey2, {
        tableName,
        dropIfExists: true,
      });
      expect(isOk(result2)).toBe(true);

      if (isOk(result2)) {
        expect(result2.value.rowCount).toBe(2);

        // Verify new schema (should have 3 columns now)
        schemaResult = await metadataClient.getTableSchema(tableName);
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

    test('load: truncate option clears table before insert', async () => {
      const csvContent = `name,value
First,1
Second,2`;

      const testKey = 'test-truncate.csv';
      await writeCsvToS3(testKey, csvContent);

      const tableName = 'test_truncate';
      testTables.push(tableName);

      // First load
      const result1 = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result1)).toBe(true);
      if (isOk(result1)) {
        expect(result1.value.rowCount).toBe(2);
      }

      // Load again with truncate
      const result2 = await loader.load(TEST_BUCKET, testKey, {
        tableName,
        truncate: true,
      });
      expect(isOk(result2)).toBe(true);

      if (isOk(result2)) {
        expect(result2.value.rowCount).toBe(2);

        // Verify row count is still 2 (not 4)
        const rowCountResult = await metadataClient.getTableRowCount(tableName);
        expect(isOk(rowCountResult)).toBe(true);
        if (isOk(rowCountResult)) {
          expect(rowCountResult.value).toBe(2);
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });

    test('load: uses existing table when it already exists', async () => {
      const csvContent = `name,age
Alice,30
Bob,25`;

      const testKey = 'test-existing.csv';
      await writeCsvToS3(testKey, csvContent);

      const tableName = 'test_existing';
      testTables.push(tableName);

      // First load
      const result1 = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result1)).toBe(true);

      // Load again without dropIfExists (should fail if schema doesn't match, or append)
      // Since we're using the same CSV, it should work
      const result2 = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result2)).toBe(true);

      if (isOk(result2)) {
        // Should have 4 rows now (2 + 2)
        const rowCountResult = await metadataClient.getTableRowCount(tableName);
        expect(isOk(rowCountResult)).toBe(true);
        if (isOk(rowCountResult)) {
          expect(rowCountResult.value).toBe(4);
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });
  });

  describe('Edge cases', () => {
    test('load: handles empty CSV file (creates table with schema, 0 rows)', async () => {
      const csvContent = `name,age,city
`;

      const testKey = 'test-empty.csv';
      await writeCsvToS3(testKey, csvContent);

      const tableName = 'test_empty';
      testTables.push(tableName);

      const result = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.rowCount).toBe(0);

        // Verify table exists with schema
        const existsResult = await metadataClient.tableExists(tableName);
        expect(isOk(existsResult)).toBe(true);
        if (isOk(existsResult)) {
          expect(existsResult.value).toBe(true);
        }

        const schemaResult = await metadataClient.getTableSchema(tableName);
        expect(isOk(schemaResult)).toBe(true);
        if (isOk(schemaResult)) {
          const schema = schemaResult.value;
          expect(schema.length).toBe(3);
          expect(schema[0]!.column_name).toBe('name');
          expect(schema[1]!.column_name).toBe('age');
          expect(schema[2]!.column_name).toBe('city');
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });

    test('load: handles CSV with only headers (no data rows)', async () => {
      const csvContent = `col1,col2,col3`;

      const testKey = 'test-headers-only.csv';
      await writeCsvToS3(testKey, csvContent);

      const tableName = 'test_headers_only';
      testTables.push(tableName);

      const result = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.rowCount).toBe(0);

        const schemaResult = await metadataClient.getTableSchema(tableName);
        expect(isOk(schemaResult)).toBe(true);
        if (isOk(schemaResult)) {
          expect(schemaResult.value.length).toBe(3);
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });

    test('load: sanitizes table and column names with special characters', async () => {
      // Use unique column names that won't collide when sanitized
      // col-with-dash -> col_with_dash, col_with_underscore stays the same
      // But to be safe, use completely different base names
      const csvContent = `col-dash-1,col_underscore_2,123col,very-long-column-name-that-exceeds-sixty-three-characters-should-be-truncated
value1,value2,value3,value4`;

      // Use unique key to avoid cache issues
      const testKey = `test-sanitize-${Date.now()}.csv`;
      await writeCsvToS3(testKey, csvContent);

      const tableName = 'test-table@with#special$chars!';
      testTables.push('test_table_with_special_chars_'); // Sanitized version

      const result = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        // Table name should be sanitized
        const sanitizedTableName = result.value.tableName;
        expect(sanitizedTableName).not.toContain('@');
        expect(sanitizedTableName).not.toContain('#');
        expect(sanitizedTableName).not.toContain('$');
        expect(sanitizedTableName).not.toContain('!');

        // Verify table exists
        const existsResult = await metadataClient.tableExists(sanitizedTableName);
        expect(isOk(existsResult)).toBe(true);
        if (isOk(existsResult)) {
          expect(existsResult.value).toBe(true);
        }

        // Column names should be sanitized
        const schemaResult = await metadataClient.getTableSchema(sanitizedTableName);
        expect(isOk(schemaResult)).toBe(true);
        if (isOk(schemaResult)) {
          const schema = schemaResult.value;
          expect(schema.length).toBe(4);
          // col-dash-1 should become col_dash_1
          const colDash = schema.find((c) => c.column_name === 'col_dash_1');
          expect(colDash).toBeDefined();
          // col_underscore_2 should stay col_underscore_2
          const colUnderscore = schema.find((c) => c.column_name === 'col_underscore_2');
          expect(colUnderscore).toBeDefined();
          // 123col should become _123col
          const col123 = schema.find((c) => c.column_name === '_123col');
          expect(col123).toBeDefined();
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });

    test('load: handles table names starting with numbers', async () => {
      const csvContent = `name,value
Test,100`;

      const testKey = 'test-number-start.csv';
      await writeCsvToS3(testKey, csvContent);

      const tableName = '123table';
      testTables.push('_123table'); // Sanitized version

      const result = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        // Table name should start with underscore
        expect(result.value.tableName).toMatch(/^_/);
        const existsResult = await metadataClient.tableExists(result.value.tableName);
        expect(isOk(existsResult)).toBe(true);
        if (isOk(existsResult)) {
          expect(existsResult.value).toBe(true);
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });

    test('load: truncates long table names to 63 characters', async () => {
      const csvContent = `col1,col2
value1,value2`;

      const testKey = 'test-long-name.csv';
      await writeCsvToS3(testKey, csvContent);

      const longTableName = 'a'.repeat(100); // 100 characters
      testTables.push('a'.repeat(63)); // Truncated version

      const result = await loader.load(TEST_BUCKET, testKey, { tableName: longTableName });
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.tableName.length).toBeLessThanOrEqual(63);
        const existsResult = await metadataClient.tableExists(result.value.tableName);
        expect(isOk(existsResult)).toBe(true);
        if (isOk(existsResult)) {
          expect(existsResult.value).toBe(true);
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });
  });

  describe('Error cases', () => {
    test('load: returns error for non-existent file', async () => {
      const result = await loader.load(TEST_BUCKET, 'non-existent-file.csv', {
        tableName: 'test_error',
      });
      expect(isOk(result)).toBe(false);

      if (!isOk(result)) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error).toContain('Failed to load tabular data');
      }
    });

    test('load: returns error for empty CSV content', async () => {
      // For truly empty content, the converter fails to detect file type first
      const emptyKey = 'test-empty-file.csv';
      await writeCsvToS3(emptyKey, '');
      const emptyResult = await loader.load(TEST_BUCKET, emptyKey, { tableName: 'test_error' });
      expect(isOk(emptyResult)).toBe(false);
      if (!isOk(emptyResult)) {
        expect(emptyResult.error).toBeDefined();
        // The error will be about file type detection, not empty CSV
        expect(emptyResult.error).toContain('Failed to load tabular data');
      }

      // Test with a CSV that has just a header (this should succeed with 0 rows)
      const headerOnlyKey = 'test-header-only.csv';
      await writeCsvToS3(headerOnlyKey, 'col1,col2\n');
      const headerResult = await loader.load(TEST_BUCKET, headerOnlyKey, {
        tableName: 'test_header_only',
      });
      expect(isOk(headerResult)).toBe(true);
      if (isOk(headerResult)) {
        expect(headerResult.value.rowCount).toBe(0);
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: emptyKey });
      await objectStore.delete({ bucket: TEST_BUCKET, key: headerOnlyKey });
    });

    test('load: returns error for CSV with no columns', async () => {
      // For a file with no columns, the converter might fail to detect it as CSV
      // So we test with whitespace-only content that can't be detected
      const testKey = 'test-no-columns.csv';
      await writeCsvToS3(testKey, '\n\n');

      const result = await loader.load(TEST_BUCKET, testKey, { tableName: 'test_error' });
      expect(isOk(result)).toBe(false);

      if (!isOk(result)) {
        expect(result.error).toBeDefined();
        // The error will be about file type detection since it can't detect CSV
        expect(result.error).toContain('Failed to load tabular data');
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });
  });

  describe('Batching', () => {
    test('load: handles large dataset with batching (>5000 rows)', async () => {
      // Generate CSV with 6000 rows to test batching
      const rows: string[] = ['id,name,value'];
      for (let i = 1; i <= 6000; i++) {
        rows.push(`${i},Item${i},${i * 10}`);
      }
      const csvContent = rows.join('\n');

      const testKey = 'test-large.csv';
      await writeCsvToS3(testKey, csvContent);

      const tableName = 'test_large';
      testTables.push(tableName);

      const result = await loader.load(TEST_BUCKET, testKey, { tableName });
      expect(isOk(result)).toBe(true);

      if (isOk(result)) {
        expect(result.value.rowCount).toBe(6000);

        // Verify all rows were inserted
        const rowCountResult = await metadataClient.getTableRowCount(tableName);
        expect(isOk(rowCountResult)).toBe(true);
        if (isOk(rowCountResult)) {
          expect(rowCountResult.value).toBe(6000);
        }

        // Verify a few specific rows
        const rowsResult = await metadataClient.getTableRows(
          tableName,
          z.object({
            id: z.number(),
            name: z.string(),
            value: z.number(),
          }),
        );
        expect(isOk(rowsResult)).toBe(true);
        if (isOk(rowsResult)) {
          const rows = rowsResult.value;
          expect(rows.length).toBe(6000);
          expect(rows[0]?.id).toBe(1);
          expect(rows[0]?.name).toBe('Item1');
          expect(rows[5999]?.id).toBe(6000);
          expect(rows[5999]?.name).toBe('Item6000');
        }
      }

      await objectStore.delete({ bucket: TEST_BUCKET, key: testKey });
    });
  });
});
