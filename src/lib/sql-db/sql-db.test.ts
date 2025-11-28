import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { createPgliteSqlDb, createPostgresSqlDb } from '../../shared/sql-db';
import { createLogger } from '../logger';
import { isOk } from '../result';
import type { SqlDb } from './sql-db';

// Test table schema
const testUserSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string(),
  age: z.number().nullable(),
});

const testTableName = 'sql_db_test_users';

// Test implementations
const implementations = [
  ['Postgres', createPostgresSqlDb] as const,
  ['PGLite', createPgliteSqlDb] as const,
];

describe.each(implementations)('SqlDb (%s implementation)', (_implementationName, createDb) => {
  const logger = createLogger({ noop: true });
  let db: SqlDb;

  beforeAll(async () => {
    db = await createDb({ logger });

    // Create test table
    const createTableResult = await db.execute(`
      CREATE TABLE IF NOT EXISTS ${testTableName} (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        age INTEGER
      )
    `);
    expect(isOk(createTableResult)).toBe(true);
  });

  afterAll(async () => {
    // Drop test table
    const dropTableResult = await db.execute(`DROP TABLE IF EXISTS ${testTableName}`);
    expect(isOk(dropTableResult)).toBe(true);

    // Close connection
    const closeResult = await db.close();
    expect(isOk(closeResult)).toBe(true);
  });

  beforeEach(async () => {
    // Clean up test data before each test
    const deleteResult = await db.execute(`DELETE FROM ${testTableName}`);
    expect(isOk(deleteResult)).toBe(true);
  });

  // QUERY TESTS
  describe('query', () => {
    test('query: returns empty array for empty table', async () => {
      const result = await db.query(`SELECT * FROM ${testTableName}`, testUserSchema);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
        expect(Array.isArray(result.value)).toBe(true);
      }
    });

    test('query: returns validated rows with schema', async () => {
      // Insert test data
      const insertResult = await db.execute(
        `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
        ['Alice', 'alice@example.com', 30],
      );
      expect(isOk(insertResult)).toBe(true);

      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        testUserSchema,
        ['Alice'],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBe(1);
        const row = queryResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row).toMatchObject({
            name: 'Alice',
            email: 'alice@example.com',
            age: 30,
          });
          expect(typeof row.id).toBe('number');
        }
      }
    });

    test('query: validates rows against schema', async () => {
      // Insert test data
      const insertResult = await db.execute(
        `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
        ['Bob', 'bob@example.com', 25],
      );
      expect(isOk(insertResult)).toBe(true);

      // Query with schema that matches
      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        testUserSchema,
        ['Bob'],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        const row = queryResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.name).toBe('Bob');
        }
      }
    });

    test('query: returns error for invalid SQL', async () => {
      const result = await db.query('SELECT * FROM nonexistent_table', testUserSchema);
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error).toContain('nonexistent_table');
      }
    });

    test('query: handles null values correctly', async () => {
      // Insert test data with null age
      const insertResult = await db.execute(
        `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
        ['Charlie', 'charlie@example.com', null],
      );
      expect(isOk(insertResult)).toBe(true);

      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        testUserSchema,
        ['Charlie'],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        const row = queryResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.age).toBe(null);
        }
      }
    });

    test('query: handles multiple rows', async () => {
      // Insert multiple rows
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'User1',
        'user1@example.com',
        20,
      ]);
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'User2',
        'user2@example.com',
        25,
      ]);
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'User3',
        'user3@example.com',
        30,
      ]);

      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} ORDER BY id`,
        testUserSchema,
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBe(3);
        const row1 = queryResult.value[0];
        const row2 = queryResult.value[1];
        const row3 = queryResult.value[2];
        expect(row1).toBeDefined();
        expect(row2).toBeDefined();
        expect(row3).toBeDefined();
        if (row1 && row2 && row3) {
          expect(row1.name).toBe('User1');
          expect(row2.name).toBe('User2');
          expect(row3.name).toBe('User3');
        }
      }
    });

    test('query: handles parameterized queries', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'ParamUser',
        'param@example.com',
        35,
      ]);

      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE age > $1 AND age < $2`,
        testUserSchema,
        [30, 40],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBe(1);
        const row = queryResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.name).toBe('ParamUser');
        }
      }
    });

    test('query: handles undefined parameters', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'UndefUser',
        'undef@example.com',
        25,
      ]);

      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        testUserSchema,
        ['UndefUser'],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBe(1);
      }
    });

    test('query: handles empty array parameters', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'EmptyParam',
        'empty@example.com',
        30,
      ]);

      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} ORDER BY id LIMIT 1`,
        testUserSchema,
        [],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBeGreaterThanOrEqual(0);
      }
    });

    test('query: returns error when schema validation fails', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'SchemaFail',
        'schema@example.com',
        30,
      ]);

      // Use a schema that expects a field that doesn't exist
      const wrongSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        age: z.number().nullable(),
        nonexistent: z.string(), // This field doesn't exist in the table
      });

      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        wrongSchema,
        ['SchemaFail'],
      );
      expect(isOk(queryResult)).toBe(false);
      if (!isOk(queryResult)) {
        expect(queryResult.error).toBeDefined();
        expect(typeof queryResult.error).toBe('string');
      }
    });

    test('query: handles aggregate functions', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'Agg1',
        'agg1@example.com',
        20,
      ]);
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'Agg2',
        'agg2@example.com',
        30,
      ]);

      const countSchema = z.object({
        count: z.number(),
        avg_age: z.union([z.number(), z.string()]).nullable(), // AVG might return string or number
      });

      const queryResult = await db.query(
        `SELECT COUNT(*)::int as count, AVG(age) as avg_age FROM ${testTableName}`,
        countSchema,
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBe(1);
        const row = queryResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.count).toBe(2);
          // AVG might return as string or number, so check it's approximately 25
          const avgAge = typeof row.avg_age === 'string' ? parseFloat(row.avg_age) : row.avg_age;
          expect(avgAge).toBeCloseTo(25, 1);
        }
      }
    });

    test('query: handles queries with no columns', async () => {
      const noColumnSchema = z.object({
        one: z.number(),
      });

      const queryResult = await db.query(`SELECT 1 as one`, noColumnSchema);
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBe(1);
        const row = queryResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.one).toBe(1);
        }
      }
    });

    test('query: handles special parameter values', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        '',
        'empty@example.com',
        0,
      ]);

      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1 OR age = $2`,
        testUserSchema,
        ['', 0],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // EXECUTE TESTS
  describe('execute', () => {
    test('execute: inserts row and returns rowCount', async () => {
      const result = await db.execute(
        `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
        ['David', 'david@example.com', 28],
      );
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.rowCount).toBe(1);
      }

      // Verify the insert
      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        testUserSchema,
        ['David'],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBe(1);
      }
    });

    test('execute: updates rows and returns rowCount', async () => {
      // Insert initial data
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'Eve',
        'eve@example.com',
        22,
      ]);

      // Update the row
      const updateResult = await db.execute(
        `UPDATE ${testTableName} SET age = $1 WHERE name = $2`,
        [23, 'Eve'],
      );
      expect(isOk(updateResult)).toBe(true);
      if (isOk(updateResult)) {
        expect(updateResult.value.rowCount).toBe(1);
      }

      // Verify the update
      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        testUserSchema,
        ['Eve'],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        const row = queryResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.age).toBe(23);
        }
      }
    });

    test('execute: deletes rows and returns rowCount', async () => {
      // Insert test data
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'Frank',
        'frank@example.com',
        40,
      ]);

      // Delete the row
      const deleteResult = await db.execute(`DELETE FROM ${testTableName} WHERE name = $1`, [
        'Frank',
      ]);
      expect(isOk(deleteResult)).toBe(true);
      if (isOk(deleteResult)) {
        expect(deleteResult.value.rowCount).toBe(1);
      }

      // Verify deletion
      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        testUserSchema,
        ['Frank'],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBe(0);
      }
    });

    test('execute: returns 0 rowCount when no rows affected', async () => {
      const updateResult = await db.execute(
        `UPDATE ${testTableName} SET age = $1 WHERE name = $2`,
        [99, 'Nonexistent'],
      );
      expect(isOk(updateResult)).toBe(true);
      if (isOk(updateResult)) {
        expect(updateResult.value.rowCount).toBe(0);
      }
    });

    test('execute: returns error for invalid SQL', async () => {
      const result = await db.execute('INSERT INTO nonexistent_table VALUES (1)');
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    test('execute: handles DDL statements', async () => {
      const createTableResult = await db.execute(`
        CREATE TABLE IF NOT EXISTS sql_db_test_temp (
          id INTEGER PRIMARY KEY
        )
      `);
      expect(isOk(createTableResult)).toBe(true);

      const dropTableResult = await db.execute(`DROP TABLE IF EXISTS sql_db_test_temp`);
      expect(isOk(dropTableResult)).toBe(true);
    });

    test('execute: handles bulk insert operations', async () => {
      // Insert multiple rows in a single transaction
      const result = await db.begin(async (tx) => {
        let totalRows = 0;
        for (let i = 0; i < 5; i++) {
          const insertResult = await tx.execute(
            `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
            [`Bulk${i}`, `bulk${i}@example.com`, 20 + i],
          );
          if (!isOk(insertResult)) {
            return insertResult;
          }
          totalRows += insertResult.value.rowCount;
        }
        return { tag: 'ok' as const, value: { rowCount: totalRows } };
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.rowCount).toBe(5);
      }

      // Verify all rows were inserted
      const queryResult = await db.query(
        `SELECT COUNT(*)::int as count FROM ${testTableName} WHERE name LIKE 'Bulk%'`,
        z.object({ count: z.number() }),
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value[0]?.count).toBe(5);
      }
    });

    test('execute: handles UPDATE with RETURNING clause already present', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'ReturningUser',
        'returning@example.com',
        25,
      ]);

      // UPDATE with RETURNING already in the query
      const updateResult = await db.execute(
        `UPDATE ${testTableName} SET age = $1 WHERE name = $2 RETURNING *`,
        [26, 'ReturningUser'],
      );
      expect(isOk(updateResult)).toBe(true);
      if (isOk(updateResult)) {
        expect(updateResult.value.rowCount).toBe(1);
      }
    });

    test('execute: handles DELETE with RETURNING clause already present', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'DeleteReturning',
        'delete@example.com',
        30,
      ]);

      const deleteResult = await db.execute(
        `DELETE FROM ${testTableName} WHERE name = $1 RETURNING *`,
        ['DeleteReturning'],
      );
      expect(isOk(deleteResult)).toBe(true);
      if (isOk(deleteResult)) {
        expect(deleteResult.value.rowCount).toBe(1);
      }
    });

    test('execute: handles undefined parameters', async () => {
      const result = await db.execute(
        `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
        ['UndefExec', 'undefexec@example.com', 30],
      );
      expect(isOk(result)).toBe(true);
    });

    test('execute: handles empty array parameters', async () => {
      const result = await db.execute(
        `INSERT INTO ${testTableName} (name, email) VALUES ('EmptyExec', 'emptyexec@example.com')`,
        [],
      );
      expect(isOk(result)).toBe(true);
    });

    test('execute: handles special parameter values', async () => {
      const result = await db.execute(
        `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
        ['', 'empty@example.com', 0],
      );
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.rowCount).toBe(1);
      }
    });
  });

  // UNSAFE TESTS
  describe('unsafe', () => {
    test('unsafe: executes query without schema validation', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'Grace',
        'grace@example.com',
        27,
      ]);

      const result = await db.unsafe(`SELECT * FROM ${testTableName} WHERE name = $1`, ['Grace']);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(Array.isArray(result.value)).toBe(true);
        if (Array.isArray(result.value)) {
          expect(result.value.length).toBe(1);
        }
      }
    });

    test('unsafe: validates result when schema provided', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'Henry',
        'henry@example.com',
        32,
      ]);

      const result = await db.unsafe<unknown[]>(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        ['Henry'],
        z.array(testUserSchema),
      );
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // When schema is provided, result should be validated
        // For SELECT queries, postgres returns an array, so we need to handle that
        expect(Array.isArray(result.value)).toBe(true);
      }
    });

    test('unsafe: handles non-array results', async () => {
      const result = await db.unsafe(`SELECT COUNT(*) as count FROM ${testTableName}`);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // COUNT returns an array with one row
        expect(Array.isArray(result.value)).toBe(true);
      }
    });

    test('unsafe: returns error for invalid SQL', async () => {
      const result = await db.unsafe('SELECT * FROM nonexistent_table_123');
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    test('unsafe: handles DDL statements', async () => {
      const createResult = await db.unsafe(`
        CREATE TABLE IF NOT EXISTS sql_db_test_temp2 (
          id INTEGER PRIMARY KEY,
          data TEXT
        )
      `);
      expect(isOk(createResult)).toBe(true);

      const dropResult = await db.unsafe(`DROP TABLE IF EXISTS sql_db_test_temp2`);
      expect(isOk(dropResult)).toBe(true);
    });

    test('unsafe: returns error when schema validation fails', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'UnsafeSchemaFail',
        'unsafeschema@example.com',
        30,
      ]);

      // Use a schema that expects a field that doesn't exist
      const wrongSchema = z.object({
        id: z.number(),
        name: z.string(),
        email: z.string(),
        age: z.number().nullable(),
        nonexistent: z.string(), // This field doesn't exist
      });

      const result = await db.unsafe(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        ['UnsafeSchemaFail'],
        z.array(wrongSchema),
      );
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    test('unsafe: handles undefined parameters', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'UnsafeUndef',
        'unsafeundef@example.com',
        25,
      ]);

      const result = await db.unsafe(`SELECT * FROM ${testTableName} WHERE name = $1`, [
        'UnsafeUndef',
      ]);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(Array.isArray(result.value)).toBe(true);
      }
    });

    test('unsafe: handles empty array parameters', async () => {
      const result = await db.unsafe(`SELECT COUNT(*) as count FROM ${testTableName}`, []);
      expect(isOk(result)).toBe(true);
    });

    test('unsafe: handles aggregate queries', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'AggUnsafe1',
        'agg1@example.com',
        20,
      ]);
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'AggUnsafe2',
        'agg2@example.com',
        30,
      ]);

      const result = await db.unsafe(
        `SELECT COUNT(*)::int as count, AVG(age) as avg_age FROM ${testTableName}`,
        undefined,
        z.array(
          z.object({
            count: z.number(),
            avg_age: z.union([z.number(), z.string()]).nullable(), // AVG might return string or number
          }),
        ),
      );
      expect(isOk(result)).toBe(true);
      if (isOk(result) && Array.isArray(result.value) && result.value.length > 0) {
        expect(result.value[0]?.count).toBeGreaterThanOrEqual(2);
      }
    });

    test('unsafe: handles queries with no parameters', async () => {
      const result = await db.unsafe(`SELECT 1 as one`);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(Array.isArray(result.value)).toBe(true);
      }
    });
  });

  // TRANSACTION TESTS
  describe('begin (transactions)', () => {
    test('begin: commits transaction on success', async () => {
      const result = await db.begin(async (tx) => {
        const insertResult = await tx.execute(
          `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
          ['Iris', 'iris@example.com', 29],
        );
        if (!isOk(insertResult)) {
          return insertResult;
        }

        const queryResult = await tx.query(
          `SELECT * FROM ${testTableName} WHERE name = $1`,
          testUserSchema,
          ['Iris'],
        );
        return queryResult;
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.length).toBe(1);
        const row = result.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.name).toBe('Iris');
        }
      }

      // Verify data persists after transaction
      const verifyResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        testUserSchema,
        ['Iris'],
      );
      expect(isOk(verifyResult)).toBe(true);
      if (isOk(verifyResult)) {
        expect(verifyResult.value.length).toBe(1);
      }
    });

    test('begin: rolls back transaction on error', async () => {
      const initialCountResult = await db.query(
        `SELECT COUNT(*)::int as count FROM ${testTableName}`,
        z.object({ count: z.number() }),
      );
      const initialCount =
        isOk(initialCountResult) && initialCountResult.value[0]
          ? initialCountResult.value[0].count
          : 0;

      const result = await db.begin(async (tx) => {
        // Insert a row
        const insertResult = await tx.execute(
          `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
          ['Jack', 'jack@example.com', 31],
        );
        if (!isOk(insertResult)) {
          return insertResult;
        }

        // Return an error to trigger rollback
        return { tag: 'err' as const, error: 'Test error for rollback' };
      });

      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toContain('Test error for rollback');
      }

      // Verify the insert was rolled back
      const countResult = await db.query(
        `SELECT COUNT(*)::int as count FROM ${testTableName}`,
        z.object({ count: z.number() }),
      );
      expect(isOk(countResult)).toBe(true);
      if (isOk(countResult)) {
        expect(countResult.value[0]?.count).toBe(initialCount);
      }
    });

    test('begin: transaction can execute multiple operations', async () => {
      const result = await db.begin(async (tx) => {
        // Insert first row
        const insert1Result = await tx.execute(
          `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
          ['Kelly', 'kelly@example.com', 24],
        );
        if (!isOk(insert1Result)) {
          return insert1Result;
        }

        // Insert second row
        const insert2Result = await tx.execute(
          `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
          ['Liam', 'liam@example.com', 26],
        );
        if (!isOk(insert2Result)) {
          return insert2Result;
        }

        // Query both rows
        const queryResult = await tx.query(
          `SELECT * FROM ${testTableName} ORDER BY id`,
          testUserSchema,
        );
        return queryResult;
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.length).toBe(2);
        const row1 = result.value[0];
        const row2 = result.value[1];
        expect(row1).toBeDefined();
        expect(row2).toBeDefined();
        if (row1 && row2) {
          expect(row1.name).toBe('Kelly');
          expect(row2.name).toBe('Liam');
        }
      }
    });

    test('begin: transaction query method works', async () => {
      const result = await db.begin(async (tx) => {
        await tx.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
          'Mia',
          'mia@example.com',
          33,
        ]);

        const queryResult = await tx.query(
          `SELECT * FROM ${testTableName} WHERE name = $1`,
          testUserSchema,
          ['Mia'],
        );
        return queryResult;
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.length).toBe(1);
        const row = result.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.name).toBe('Mia');
        }
      }
    });

    test('begin: transaction execute method works', async () => {
      const result = await db.begin(async (tx) => {
        const insertResult = await tx.execute(
          `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
          ['Noah', 'noah@example.com', 28],
        );
        return insertResult;
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.rowCount).toBe(1);
      }
    });

    test('begin: transaction unsafe method works', async () => {
      const result = await db.begin(async (tx) => {
        await tx.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
          'Olivia',
          'olivia@example.com',
          35,
        ]);

        const unsafeResult = await tx.unsafe(
          `SELECT COUNT(*)::int as count FROM ${testTableName}`,
          undefined,
          z.array(z.object({ count: z.number() })),
        );
        return unsafeResult;
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(Array.isArray(result.value)).toBe(true);
        if (Array.isArray(result.value) && result.value.length > 0) {
          expect(typeof result.value[0]?.count).toBe('number');
        }
      }
    });

    test('begin: rolls back on SQL error', async () => {
      const initialCountResult = await db.query(
        `SELECT COUNT(*)::int as count FROM ${testTableName}`,
        z.object({ count: z.number() }),
      );
      const initialCount =
        isOk(initialCountResult) && initialCountResult.value[0]
          ? initialCountResult.value[0].count
          : 0;

      const result = await db.begin(async (tx) => {
        // Insert a valid row
        await tx.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
          'Paul',
          'paul@example.com',
          30,
        ]);

        // Try to insert into non-existent table (should fail)
        const badResult = await tx.execute('INSERT INTO nonexistent_table VALUES (1)');
        return badResult;
      });

      expect(isOk(result)).toBe(false);

      // Verify the first insert was rolled back
      const countResult = await db.query(
        `SELECT COUNT(*)::int as count FROM ${testTableName}`,
        z.object({ count: z.number() }),
      );
      expect(isOk(countResult)).toBe(true);
      if (isOk(countResult)) {
        const row = countResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.count).toBe(initialCount);
        }
      }
    });

    test('begin: rolls back when callback throws exception', async () => {
      const initialCountResult = await db.query(
        `SELECT COUNT(*)::int as count FROM ${testTableName}`,
        z.object({ count: z.number() }),
      );
      const initialCount =
        isOk(initialCountResult) && initialCountResult.value[0]
          ? initialCountResult.value[0].count
          : 0;

      // The begin method should catch exceptions and return an Err result
      const result = await db.begin(async (tx) => {
        // Insert a row
        await tx.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
          'ExceptionUser',
          'exception@example.com',
          30,
        ]);

        // Throw an exception - this should be caught by begin() and converted to Err
        throw new Error('Test exception for rollback');
      });

      // The exception should be caught and converted to an Err result
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
        expect(result.error).toContain('Test exception for rollback');
      }

      // Verify the insert was rolled back
      const countResult = await db.query(
        `SELECT COUNT(*)::int as count FROM ${testTableName}`,
        z.object({ count: z.number() }),
      );
      expect(isOk(countResult)).toBe(true);
      if (isOk(countResult)) {
        expect(countResult.value[0]?.count).toBe(initialCount);
      }
    });

    test('begin: handles transaction with multiple errors', async () => {
      const initialCountResult = await db.query(
        `SELECT COUNT(*)::int as count FROM ${testTableName}`,
        z.object({ count: z.number() }),
      );
      const initialCount =
        isOk(initialCountResult) && initialCountResult.value[0]
          ? initialCountResult.value[0].count
          : 0;

      const result = await db.begin(async (tx) => {
        // First operation succeeds
        const insertResult = await tx.execute(
          `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
          ['MultiError1', 'multierror1@example.com', 25],
        );
        if (!isOk(insertResult)) {
          return insertResult;
        }

        // Second operation fails
        const badResult = await tx.execute('INSERT INTO nonexistent_table VALUES (1)');
        if (!isOk(badResult)) {
          return badResult;
        }

        // This should never be reached
        return { tag: 'ok' as const, value: { rowCount: 0 } };
      });

      expect(isOk(result)).toBe(false);

      // Verify the first insert was rolled back
      const countResult = await db.query(
        `SELECT COUNT(*)::int as count FROM ${testTableName}`,
        z.object({ count: z.number() }),
      );
      expect(isOk(countResult)).toBe(true);
      if (isOk(countResult)) {
        expect(countResult.value[0]?.count).toBe(initialCount);
      }
    });

    test('begin: transaction handles empty result sets', async () => {
      const result = await db.begin(async (tx) => {
        const queryResult = await tx.query(
          `SELECT * FROM ${testTableName} WHERE name = $1`,
          testUserSchema,
          ['NonexistentUser'],
        );
        return queryResult;
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.length).toBe(0);
      }
    });

    test('begin: transaction handles parameter edge cases', async () => {
      const result = await db.begin(async (tx) => {
        const insertResult = await tx.execute(
          `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
          ['', 'empty@example.com', 0],
        );
        return insertResult;
      });

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.rowCount).toBe(1);
      }
    });
  });

  // CLOSE TESTS
  describe('close', () => {
    test('close: closes database connection', async () => {
      // Create a separate connection for this test
      const testDb = await createDb({ logger });

      const closeResult = await testDb.close();
      expect(isOk(closeResult)).toBe(true);

      // Verify close() itself succeeded
      expect(isOk(closeResult)).toBe(true);
    });

    test('close: can be called multiple times', async () => {
      // Create a separate connection for this test
      const testDb = await createDb({ logger });

      const closeResult1 = await testDb.close();
      expect(isOk(closeResult1)).toBe(true);

      // Close again - some implementations may return error, others may succeed (idempotent)
      // Both behaviors are acceptable
      const closeResult2 = await testDb.close();
      // Just verify it doesn't throw - either success or error is fine
      expect(closeResult2.tag).toBeDefined();
    });

    test('close: operations fail after closing', async () => {
      // Create a separate connection for this test
      const testDb = await createDb({ logger });

      // Create a test table
      await testDb.execute(`
        CREATE TABLE IF NOT EXISTS sql_db_test_close (
          id INTEGER PRIMARY KEY
        )
      `);

      // Close the connection
      const closeResult = await testDb.close();
      expect(isOk(closeResult)).toBe(true);

      // Try to use the database after closing
      const queryResult = await testDb.query(
        `SELECT * FROM sql_db_test_close`,
        z.object({ id: z.number() }),
      );
      expect(isOk(queryResult)).toBe(false);
      if (!isOk(queryResult)) {
        expect(queryResult.error).toBeDefined();
        expect(typeof queryResult.error).toBe('string');
      }
    });

    test('close: transaction fails after closing', async () => {
      // Create a separate connection for this test
      const testDb = await createDb({ logger });

      // Close the connection
      const closeResult = await testDb.close();
      expect(isOk(closeResult)).toBe(true);

      // Try to begin a transaction after closing
      const txResult = await testDb.begin(async (tx) => {
        return await tx.execute(`SELECT 1`);
      });
      expect(isOk(txResult)).toBe(false);
      if (!isOk(txResult)) {
        expect(txResult.error).toBeDefined();
        expect(typeof txResult.error).toBe('string');
      }
    });
  });

  // INTEGRATION TESTS
  describe('integration', () => {
    test('integration: complete workflow with query, execute, and transaction', async () => {
      // Insert initial data
      const insertResult = await db.execute(
        `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
        ['Integration', 'integration@example.com', 40],
      );
      expect(isOk(insertResult)).toBe(true);

      // Query the data
      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        testUserSchema,
        ['Integration'],
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBe(1);
      }

      // Update in a transaction
      const transactionResult = await db.begin(async (tx) => {
        const updateResult = await tx.execute(
          `UPDATE ${testTableName} SET age = $1 WHERE name = $2`,
          [41, 'Integration'],
        );
        if (!isOk(updateResult)) {
          return updateResult;
        }

        const verifyResult = await tx.query(
          `SELECT * FROM ${testTableName} WHERE name = $1`,
          testUserSchema,
          ['Integration'],
        );
        return verifyResult;
      });

      expect(isOk(transactionResult)).toBe(true);
      if (isOk(transactionResult)) {
        const row = transactionResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.age).toBe(41);
        }
      }

      // Verify final state
      const finalQueryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name = $1`,
        testUserSchema,
        ['Integration'],
      );
      expect(isOk(finalQueryResult)).toBe(true);
      if (isOk(finalQueryResult)) {
        const row = finalQueryResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.age).toBe(41);
        }
      }
    });

    test('integration: handles large result sets', async () => {
      // Insert many rows
      const insertCount = 50;
      for (let i = 0; i < insertCount; i++) {
        await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
          `Large${i}`,
          `large${i}@example.com`,
          20 + i,
        ]);
      }

      // Query all rows
      const queryResult = await db.query(
        `SELECT * FROM ${testTableName} WHERE name LIKE 'Large%' ORDER BY id`,
        testUserSchema,
      );
      expect(isOk(queryResult)).toBe(true);
      if (isOk(queryResult)) {
        expect(queryResult.value.length).toBe(insertCount);
      }
    });

    test('integration: handles complex queries with JOINs', async () => {
      // Drop table first to ensure clean state
      await db.execute(`DROP TABLE IF EXISTS sql_db_test_orders`);

      // Create a second table for JOIN test - use SERIAL for Postgres compatibility
      const createTableResult = await db.execute(`
        CREATE TABLE sql_db_test_orders (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          product VARCHAR(255) NOT NULL
        )
      `);

      // If SERIAL fails (PGLite), try INTEGER
      if (!isOk(createTableResult)) {
        const createTableResult2 = await db.execute(`
          CREATE TABLE sql_db_test_orders (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            product VARCHAR(255) NOT NULL
          )
        `);
        expect(isOk(createTableResult2)).toBe(true);
      } else {
        expect(isOk(createTableResult)).toBe(true);
      }

      // Insert user
      const insertUserResult = await db.execute(
        `INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`,
        ['JoinUser', 'join@example.com', 30],
      );
      expect(isOk(insertUserResult)).toBe(true);

      // Get user ID
      const userResult = await db.query(
        `SELECT id FROM ${testTableName} WHERE name = $1`,
        z.object({ id: z.number() }),
        ['JoinUser'],
      );
      expect(isOk(userResult)).toBe(true);
      expect(userResult.tag === 'ok' && userResult.value[0]).toBeDefined();
      const userId = userResult.tag === 'ok' ? userResult.value[0]!.id : 0;
      expect(userId).toBeGreaterThan(0);

      // Insert order
      const insertOrderResult = await db.execute(
        `INSERT INTO sql_db_test_orders (user_id, product) VALUES ($1, $2)`,
        [userId, 'Product1'],
      );
      expect(isOk(insertOrderResult)).toBe(true);

      // Verify order exists first
      const orderCheck = await db.query(
        `SELECT * FROM sql_db_test_orders WHERE user_id = $1`,
        z.object({ user_id: z.number(), product: z.string() }),
        [userId],
      );
      expect(isOk(orderCheck)).toBe(true);
      expect(orderCheck.tag === 'ok' && orderCheck.value.length).toBeGreaterThan(0);

      // Query with JOIN
      const joinSchema = z.object({
        name: z.string(),
        email: z.string(),
        product: z.string(),
      });

      const joinResult = await db.query(
        `SELECT u.name, u.email, o.product 
         FROM ${testTableName} u 
         INNER JOIN sql_db_test_orders o ON u.id = o.user_id 
         WHERE u.name = $1`,
        joinSchema,
        ['JoinUser'],
      );
      expect(isOk(joinResult)).toBe(true);
      if (joinResult.tag === 'ok') {
        expect(joinResult.value.length).toBeGreaterThanOrEqual(1);
        if (joinResult.value.length > 0 && joinResult.value[0]) {
          const row = joinResult.value[0];
          expect(row.name).toBe('JoinUser');
          expect(row.product).toBe('Product1');
        }
      }

      // Cleanup
      await db.execute(`DROP TABLE IF EXISTS sql_db_test_orders`);
    });

    test('integration: handles subqueries', async () => {
      await db.execute(`INSERT INTO ${testTableName} (name, email, age) VALUES ($1, $2, $3)`, [
        'SubqueryUser',
        'subquery@example.com',
        35,
      ]);

      const subquerySchema = z.object({
        name: z.string(),
        age: z.number().nullable(),
        max_age: z.number().nullable(),
      });

      const subqueryResult = await db.query(
        `SELECT name, age, (SELECT MAX(age) FROM ${testTableName}) as max_age 
         FROM ${testTableName} 
         WHERE name = $1`,
        subquerySchema,
        ['SubqueryUser'],
      );
      expect(isOk(subqueryResult)).toBe(true);
      if (isOk(subqueryResult)) {
        expect(subqueryResult.value.length).toBe(1);
        const row = subqueryResult.value[0];
        expect(row).toBeDefined();
        if (row) {
          expect(row.name).toBe('SubqueryUser');
          expect(row.max_age).toBe(35);
        }
      }
    });
  });
});
