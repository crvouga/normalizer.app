import { describe, expect, test } from "bun:test";
import { createLogger } from "./lib/logger";
import { createSQL, cleanupSQL } from "./sql";

describe("SQL Client", () => {
  const logger = createLogger();

  test("should initialize SQL client successfully", async () => {
    const sqlClient = await createSQL({ logger });
    expect(sqlClient).toBeDefined();
    await cleanupSQL(logger);
  });

  test("should reuse existing connection", async () => {
    const sql1 = await createSQL({ logger });
    const sql2 = await createSQL({ logger });
    expect(sql1).toBe(sql2);
    await cleanupSQL(logger);
  });

  test("should handle basic queries", async () => {
    const sql = await createSQL({ logger });

    // Test simple query
    const result = await sql`SELECT 1 as num`;
    expect(result).toBeDefined();
    expect(result[0].num).toBe(1);

    // Test parameterized query
    const testValue = "test";
    const paramResult = await sql`SELECT ${testValue} as val`;
    expect(paramResult[0].val).toBe("test");

    await cleanupSQL(logger);
  });
});
