import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { createPgliteSqlDb } from '../../shared/sql-db';
import { createLogger } from '../logger';
import { isOk } from '../result';
import type { SqlDb } from '../sql-db/sql-db';
import { createPostgresClient, PostgresClient, type TableColumn } from './postgres-client';

describe('PostgresClient', () => {
  const logger = createLogger({ noop: true });
  let db: SqlDb;
  let client: PostgresClient;
  const testTables: string[] = [];

  beforeAll(async () => {
    db = await createPgliteSqlDb({ logger });
    client = createPostgresClient({ db, logger });
  });

  afterAll(async () => {
    // Clean up test tables
    for (const tableName of testTables) {
      const dropResult = await client.dropTable(tableName);
      if (!isOk(dropResult)) {
        logger.warn('Failed to drop test table', { tableName, error: dropResult.error });
      }
    }

    // Close database connection
    const closeResult = await db.close();
    expect(isOk(closeResult)).toBe(true);
  });

  describe('escapeIdentifier', () => {
    test('escapes simple identifier', () => {
      expect(client.escapeIdentifier('users')).toBe('"users"');
    });

    test('escapes identifier with special characters', () => {
      expect(client.escapeIdentifier('user-name')).toBe('"user-name"');
    });

    test('escapes identifier with quotes', () => {
      expect(client.escapeIdentifier('user"name')).toBe('"user""name"');
    });

    test('escapes identifier with spaces', () => {
      expect(client.escapeIdentifier('user name')).toBe('"user name"');
    });

    test('escapes identifier with numbers', () => {
      expect(client.escapeIdentifier('user123')).toBe('"user123"');
    });
  });

  describe('tableExists', () => {
    test('returns false for non-existent table', async () => {
      const result = await client.viewExist('non_existent_table');
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toBe(false);
      }
    });

    test('returns true for existing table', async () => {
      const tableName = 'test_exists';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [{ name: 'id', type: 'INTEGER' }]);
      expect(isOk(createResult)).toBe(true);

      // Check if exists
      const existsResult = await client.viewExist(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }
    });

    test('handles custom schema', async () => {
      // Note: PGLite may not support custom schemas, so this test may need adjustment
      const result = await client.viewExist('non_existent', 'public');
      expect(isOk(result)).toBe(true);
    });
  });

  describe('createTable', () => {
    test('creates table with single column', async () => {
      const tableName = 'test_create_single';
      testTables.push(tableName);

      const result = await client.createTable(tableName, [{ name: 'id', type: 'INTEGER' }]);
      expect(isOk(result)).toBe(true);

      // Verify table exists
      const existsResult = await client.viewExist(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }
    });

    test('creates table with multiple columns', async () => {
      const tableName = 'test_create_multiple';
      testTables.push(tableName);

      const columns: TableColumn[] = [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'age', type: 'INTEGER' },
      ];

      const result = await client.createTable(tableName, columns);
      expect(isOk(result)).toBe(true);

      // Verify schema
      const schemaResult = await client.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        expect(schemaResult.value.length).toBe(3);
        expect(schemaResult.value[0]?.column_name).toBe('id');
        expect(schemaResult.value[1]?.column_name).toBe('name');
        expect(schemaResult.value[2]?.column_name).toBe('age');
      }
    });

    test('creates table with nullable columns', async () => {
      const tableName = 'test_create_nullable';
      testTables.push(tableName);

      const columns: TableColumn[] = [
        { name: 'id', type: 'INTEGER', nullable: false },
        { name: 'name', type: 'TEXT', nullable: true },
      ];

      const result = await client.createTable(tableName, columns);
      expect(isOk(result)).toBe(true);

      // Verify schema
      const schemaResult = await client.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const idCol = schemaResult.value.find((c) => c.column_name === 'id');
        const nameCol = schemaResult.value.find((c) => c.column_name === 'name');
        expect(idCol?.is_nullable).toBe('NO');
        expect(nameCol?.is_nullable).toBe('YES');
      }
    });

    test('creates table with all column types', async () => {
      const tableName = 'test_create_all_types';
      testTables.push(tableName);

      const columns: TableColumn[] = [
        { name: 'text_col', type: 'TEXT' },
        { name: 'integer_col', type: 'INTEGER' },
        { name: 'numeric_col', type: 'NUMERIC' },
        { name: 'boolean_col', type: 'BOOLEAN' },
        { name: 'date_col', type: 'DATE' },
        { name: 'timestamp_col', type: 'TIMESTAMP' },
      ];

      const result = await client.createTable(tableName, columns);
      expect(isOk(result)).toBe(true);

      // Verify schema
      const schemaResult = await client.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        expect(schemaResult.value.length).toBe(6);
      }
    });

    test('returns error for empty columns array', async () => {
      const result = await client.createTable('test_empty', []);
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toContain('no columns');
      }
    });

    test('handles table name with special characters', async () => {
      const tableName = 'test-special@chars';
      testTables.push(tableName);

      const result = await client.createTable(tableName, [{ name: 'id', type: 'INTEGER' }]);
      expect(isOk(result)).toBe(true);

      // Verify table exists (name will be escaped)
      const existsResult = await client.viewExist(tableName);
      expect(isOk(existsResult)).toBe(true);
    });
  });

  describe('dropTable', () => {
    test('drops existing table', async () => {
      const tableName = 'test_drop';
      testTables.push(tableName);

      // Create table first
      const createResult = await client.createTable(tableName, [{ name: 'id', type: 'INTEGER' }]);
      expect(isOk(createResult)).toBe(true);

      // Verify it exists
      let existsResult = await client.viewExist(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      // Drop it
      const dropResult = await client.dropTable(tableName);
      expect(isOk(dropResult)).toBe(true);

      // Verify it no longer exists
      existsResult = await client.viewExist(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(false);
      }

      // Remove from cleanup list since we already dropped it
      testTables.pop();
    });

    test('drops non-existent table without error (IF EXISTS)', async () => {
      const result = await client.dropTable('non_existent_table_drop');
      expect(isOk(result)).toBe(true);
    });
  });

  describe('truncateTable', () => {
    test('truncates table with data', async () => {
      const tableName = 'test_truncate';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert data
      const insertResult = await client.insertBatch(
        tableName,
        ['id', 'name'],
        [
          ['1', 'Alice'],
          ['2', 'Bob'],
        ],
      );
      expect(isOk(insertResult)).toBe(true);
      if (isOk(insertResult)) {
        expect(insertResult.value).toBe(2);
      }

      // Verify row count
      let rowCountResult = await client.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(2);
      }

      // Truncate
      const truncateResult = await client.truncateTable(tableName);
      expect(isOk(truncateResult)).toBe(true);

      // Verify row count is 0
      rowCountResult = await client.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(0);
      }
    });

    test('truncates empty table', async () => {
      const tableName = 'test_truncate_empty';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [{ name: 'id', type: 'INTEGER' }]);
      expect(isOk(createResult)).toBe(true);

      // Truncate empty table
      const truncateResult = await client.truncateTable(tableName);
      expect(isOk(truncateResult)).toBe(true);
    });
  });

  describe('getTableSchema', () => {
    test('returns schema for existing table', async () => {
      const tableName = 'test_schema';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
        { name: 'age', type: 'INTEGER' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Get schema
      const schemaResult = await client.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        expect(schema.length).toBe(3);
        expect(schema[0]?.column_name).toBe('id');
        expect(schema[0]?.data_type).toBe('integer');
        expect(schema[1]?.column_name).toBe('name');
        expect(schema[1]?.data_type).toBe('text');
        expect(schema[2]?.column_name).toBe('age');
        expect(schema[2]?.data_type).toBe('integer');
      }
    });

    test('returns empty array for non-existent table', async () => {
      const schemaResult = await client.getTableSchema('non_existent_schema');
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        expect(schemaResult.value).toEqual([]);
      }
    });

    test('returns columns in correct order', async () => {
      const tableName = 'test_schema_order';
      testTables.push(tableName);

      // Create table with specific column order
      const createResult = await client.createTable(tableName, [
        { name: 'z_col', type: 'TEXT' },
        { name: 'a_col', type: 'INTEGER' },
        { name: 'm_col', type: 'NUMERIC' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Get schema - should be in creation order
      const schemaResult = await client.getTableSchema(tableName);
      expect(isOk(schemaResult)).toBe(true);
      if (isOk(schemaResult)) {
        const schema = schemaResult.value;
        expect(schema[0]?.column_name).toBe('z_col');
        expect(schema[1]?.column_name).toBe('a_col');
        expect(schema[2]?.column_name).toBe('m_col');
      }
    });
  });

  describe('getTableRowCount', () => {
    test('returns 0 for empty table', async () => {
      const tableName = 'test_row_count_empty';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [{ name: 'id', type: 'INTEGER' }]);
      expect(isOk(createResult)).toBe(true);

      // Get row count
      const rowCountResult = await client.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(0);
      }
    });

    test('returns correct count for table with data', async () => {
      const tableName = 'test_row_count';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert data
      const insertResult = await client.insertBatch(
        tableName,
        ['id', 'name'],
        [
          ['1', 'Alice'],
          ['2', 'Bob'],
          ['3', 'Charlie'],
        ],
      );
      expect(isOk(insertResult)).toBe(true);

      // Get row count
      const rowCountResult = await client.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(3);
      }
    });
  });

  describe('getTableRows', () => {
    test('returns all rows from table', async () => {
      const tableName = 'test_get_rows';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert data
      const insertResult = await client.insertBatch(
        tableName,
        ['id', 'name'],
        [
          ['1', 'Alice'],
          ['2', 'Bob'],
        ],
      );
      expect(isOk(insertResult)).toBe(true);

      // Get rows
      const rowsResult = await client.getTableRows(
        tableName,
        z.object({
          id: z.number(),
          name: z.string(),
        }),
      );
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows.length).toBe(2);
        expect(rows[0]?.id).toBe(1);
        expect(rows[0]?.name).toBe('Alice');
        expect(rows[1]?.id).toBe(2);
        expect(rows[1]?.name).toBe('Bob');
      }
    });

    test('returns empty array for empty table', async () => {
      const tableName = 'test_get_rows_empty';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [{ name: 'id', type: 'INTEGER' }]);
      expect(isOk(createResult)).toBe(true);

      // Get rows
      const rowsResult = await client.getTableRows(tableName, z.object({ id: z.number() }));
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        expect(rowsResult.value).toEqual([]);
      }
    });

    test('validates rows against schema', async () => {
      const tableName = 'test_get_rows_validation';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert data
      const insertResult = await client.insertBatch(tableName, ['id', 'name'], [['1', 'Alice']]);
      expect(isOk(insertResult)).toBe(true);

      // Get rows with schema that matches
      const rowsResult = await client.getTableRows(
        tableName,
        z.object({
          id: z.number(),
          name: z.string(),
        }),
      );
      expect(isOk(rowsResult)).toBe(true);
    });

    test('handles custom orderBy clause', async () => {
      const tableName = 'test_get_rows_order';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert data
      const insertResult = await client.insertBatch(
        tableName,
        ['id', 'name'],
        [
          ['3', 'Charlie'],
          ['1', 'Alice'],
          ['2', 'Bob'],
        ],
      );
      expect(isOk(insertResult)).toBe(true);

      // Get rows with ORDER BY
      const rowsResult = await client.getTableRows(
        tableName,
        z.object({
          id: z.number(),
          name: z.string(),
        }),
        'public',
        'ORDER BY id',
      );
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows.length).toBe(3);
        expect(rows[0]?.id).toBe(1);
        expect(rows[1]?.id).toBe(2);
        expect(rows[2]?.id).toBe(3);
      }
    });
  });

  describe('insertBatch', () => {
    test('inserts single row', async () => {
      const tableName = 'test_insert_single';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert single row
      const insertResult = await client.insertBatch(tableName, ['id', 'name'], [['1', 'Alice']]);
      expect(isOk(insertResult)).toBe(true);
      if (isOk(insertResult)) {
        expect(insertResult.value).toBe(1);
      }

      // Verify data
      const rowCountResult = await client.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(1);
      }
    });

    test('inserts multiple rows', async () => {
      const tableName = 'test_insert_multiple';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert multiple rows
      const insertResult = await client.insertBatch(
        tableName,
        ['id', 'name'],
        [
          ['1', 'Alice'],
          ['2', 'Bob'],
          ['3', 'Charlie'],
        ],
      );
      expect(isOk(insertResult)).toBe(true);
      if (isOk(insertResult)) {
        expect(insertResult.value).toBe(3);
      }

      // Verify data
      const rowCountResult = await client.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(3);
      }
    });

    test('handles null values', async () => {
      const tableName = 'test_insert_null';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT', nullable: true },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert rows with null
      const insertResult = await client.insertBatch(
        tableName,
        ['id', 'name'],
        [
          ['1', null],
          ['2', 'Bob'],
        ],
      );
      expect(isOk(insertResult)).toBe(true);

      // Verify data
      const rowsResult = await client.getTableRows(
        tableName,
        z.object({
          id: z.number(),
          name: z.string().nullable(),
        }),
      );
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows[0]?.name).toBeNull();
        expect(rows[1]?.name).toBe('Bob');
      }
    });

    test('handles empty string as null', async () => {
      const tableName = 'test_insert_empty_string';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT', nullable: true },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert rows with empty string (should be converted to null)
      const insertResult = await client.insertBatch(
        tableName,
        ['id', 'name'],
        [
          ['1', ''],
          ['2', 'Bob'],
        ],
      );
      expect(isOk(insertResult)).toBe(true);

      // Verify data
      const rowsResult = await client.getTableRows(
        tableName,
        z.object({
          id: z.number(),
          name: z.string().nullable(),
        }),
      );
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows[0]?.name).toBeNull();
        expect(rows[1]?.name).toBe('Bob');
      }
    });

    test('returns 0 for empty rows array', async () => {
      const tableName = 'test_insert_empty';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [{ name: 'id', type: 'INTEGER' }]);
      expect(isOk(createResult)).toBe(true);

      // Insert empty array
      const insertResult = await client.insertBatch(tableName, ['id'], []);
      expect(isOk(insertResult)).toBe(true);
      if (isOk(insertResult)) {
        expect(insertResult.value).toBe(0);
      }
    });

    test('returns error for empty columns array', async () => {
      const tableName = 'test_insert_no_columns';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [{ name: 'id', type: 'INTEGER' }]);
      expect(isOk(createResult)).toBe(true);

      // Try to insert with empty columns
      const insertResult = await client.insertBatch(tableName, [], [['1']]);
      expect(isOk(insertResult)).toBe(false);
      if (!isOk(insertResult)) {
        expect(insertResult.error).toContain('no columns');
      }
    });

    test('handles large batch (>5000 rows)', async () => {
      const tableName = 'test_insert_large_batch';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'value', type: 'TEXT' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Generate 6000 rows
      const rows: (string | null)[][] = [];
      for (let i = 1; i <= 6000; i++) {
        rows.push([String(i), `Value${i}`]);
      }

      // Insert large batch
      const insertResult = await client.insertBatch(tableName, ['id', 'value'], rows);
      expect(isOk(insertResult)).toBe(true);
      if (isOk(insertResult)) {
        expect(insertResult.value).toBe(6000);
      }

      // Verify row count
      const rowCountResult = await client.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(6000);
      }
    });

    test('handles all column types in batch insert', async () => {
      const tableName = 'test_insert_all_types';
      testTables.push(tableName);

      // Create table with all types (excluding BOOLEAN as string values need type conversion)
      const createResult = await client.createTable(tableName, [
        { name: 'text_col', type: 'TEXT' },
        { name: 'integer_col', type: 'INTEGER' },
        { name: 'numeric_col', type: 'NUMERIC' },
        { name: 'date_col', type: 'DATE' },
        { name: 'timestamp_col', type: 'TIMESTAMP' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert data
      const insertResult = await client.insertBatch(
        tableName,
        ['text_col', 'integer_col', 'numeric_col', 'date_col', 'timestamp_col'],
        [['Hello', '42', '3.14', '2024-01-15', '2024-01-15 10:30:00']],
      );
      expect(isOk(insertResult)).toBe(true);

      // Verify data was inserted
      const rowCountResult = await client.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(1);
      }
    });

    test('handles special characters in values', async () => {
      const tableName = 'test_insert_special_chars';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'text', type: 'TEXT' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Insert data with special characters
      const insertResult = await client.insertBatch(
        tableName,
        ['id', 'text'],
        [
          ['1', 'Text with "quotes"'],
          ['2', 'Text with, commas'],
          ['3', 'Text with\nnewlines'],
        ],
      );
      expect(isOk(insertResult)).toBe(true);

      // Verify data
      const rowsResult = await client.getTableRows(
        tableName,
        z.object({
          id: z.number(),
          text: z.string(),
        }),
      );
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        const rows = rowsResult.value;
        expect(rows.length).toBe(3);
        expect(rows[0]?.text).toBe('Text with "quotes"');
        expect(rows[1]?.text).toBe('Text with, commas');
        expect(rows[2]?.text).toBe('Text with\nnewlines');
      }
    });
  });

  describe('Integration tests', () => {
    test('full workflow: create, insert, query, truncate, drop', async () => {
      const tableName = 'test_integration';
      testTables.push(tableName);

      // Create table
      const createResult = await client.createTable(tableName, [
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'TEXT' },
      ]);
      expect(isOk(createResult)).toBe(true);

      // Verify table exists
      let existsResult = await client.viewExist(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(true);
      }

      // Insert data
      const insertResult = await client.insertBatch(
        tableName,
        ['id', 'name'],
        [
          ['1', 'Alice'],
          ['2', 'Bob'],
        ],
      );
      expect(isOk(insertResult)).toBe(true);

      // Verify row count
      let rowCountResult = await client.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(2);
      }

      // Get rows
      const rowsResult = await client.getTableRows(
        tableName,
        z.object({
          id: z.number(),
          name: z.string(),
        }),
      );
      expect(isOk(rowsResult)).toBe(true);
      if (isOk(rowsResult)) {
        expect(rowsResult.value.length).toBe(2);
      }

      // Truncate
      const truncateResult = await client.truncateTable(tableName);
      expect(isOk(truncateResult)).toBe(true);

      // Verify row count is 0
      rowCountResult = await client.getTableRowCount(tableName);
      expect(isOk(rowCountResult)).toBe(true);
      if (isOk(rowCountResult)) {
        expect(rowCountResult.value).toBe(0);
      }

      // Drop
      const dropResult = await client.dropTable(tableName);
      expect(isOk(dropResult)).toBe(true);

      // Verify table no longer exists
      existsResult = await client.viewExist(tableName);
      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value).toBe(false);
      }

      // Remove from cleanup list
      testTables.pop();
    });
  });
});
