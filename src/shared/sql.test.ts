import { describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { createLogger } from '../lib/logger';
import { createDb, cleanupDb } from '../shared/sql';

describe('Database Client', () => {
  const logger = createLogger();

  test('should initialize database client successfully', async () => {
    const db = await createDb({ logger });
    expect(db).toBeDefined();
    await cleanupDb(logger);
  });

  test('should reuse existing connection', async () => {
    const db1 = await createDb({ logger });
    const db2 = await createDb({ logger });
    expect(db1).toBe(db2);
    await cleanupDb(logger);
  });

  test('should handle basic queries', async () => {
    const db = await createDb({ logger });

    // Test simple query using Drizzle's sql operator
    const result = await db.execute(sql`SELECT 1 as num`);
    expect(result).toBeDefined();
    expect(result[0]?.num).toBe(1);

    // Test parameterized query
    const testValue = 'test';
    const paramResult = await db.execute(sql`SELECT ${testValue} as val`);
    expect(paramResult[0]?.val).toBe('test');

    await cleanupDb(logger);
  });
});
