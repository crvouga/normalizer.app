import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { z } from 'zod';
import { createSqlDb } from '../../shared/sql-db';
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

describe('SqlDb (Postgres implementation)', () => {
  const logger = createLogger({ noop: true });
  let db: SqlDb;

  beforeAll(async () => {
    db = await createSqlDb({ logger });

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
  });

  // CLOSE TESTS
  describe('close', () => {
    test('close: closes database connection', async () => {
      // Create a separate connection for this test
      const testDb = await createSqlDb({ logger });

      const closeResult = await testDb.close();
      expect(isOk(closeResult)).toBe(true);

      // Verify close() itself succeeded
      expect(isOk(closeResult)).toBe(true);
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
  });
});
