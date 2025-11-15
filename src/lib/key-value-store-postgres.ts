import { inArray, sql } from 'drizzle-orm';
import { createDb, type Db } from '../sql';
import { createLogger } from './logger';
import * as schema from '../db/schema';
import type { KeyValueStore } from './key-value-store';
import { Ok, Err, type Result } from './result';

/**
 * Postgres implementation of KeyValueStore using the key_value_store table
 */
export class PostgresKeyValueStore implements KeyValueStore {
  private dbPromise: Promise<Db>;

  constructor() {
    const logger = createLogger();
    this.dbPromise = createDb({ logger });
  }

  private async getDb(): Promise<Db> {
    return await this.dbPromise;
  }

  async get(keys: string[]): Promise<Result<Map<string, string | null>, string>> {
    try {
      const db = await this.getDb();

      // Handle empty keys array
      if (keys.length === 0) {
        return Ok(new Map<string, string | null>());
      }

      // Remove duplicates for efficient querying
      const uniqueKeys = Array.from(new Set(keys));

      // Query database for existing keys
      const rows = await db
        .select()
        .from(schema.keyValueStore)
        .where(inArray(schema.keyValueStore.key, uniqueKeys));

      // Create a map of found keys
      const foundMap = new Map<string, string>();
      for (const row of rows) {
        foundMap.set(row.key, row.value);
      }

      // Create result map with all unique requested keys
      // Keys not found will have null value
      // Maps naturally handle duplicates (only one entry per unique key)
      const resultMap = new Map<string, string | null>();
      for (const key of uniqueKeys) {
        resultMap.set(key, foundMap.get(key) ?? null);
      }

      return Ok(resultMap);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to get keys: ${errorMessage}`);
    }
  }

  async set(entries: Record<string, string>): Promise<Result<void, string>> {
    try {
      const db = await this.getDb();

      // Handle empty entries
      if (Object.keys(entries).length === 0) {
        return Ok(undefined);
      }

      // Convert entries to array of values for bulk insert
      const now = new Date();
      const values = Object.entries(entries).map(([key, value]) => ({
        key,
        value,
        updated_at: now,
      }));

      // Use upsert (insert with conflict resolution) to handle overwrites
      // EXCLUDED references the row being inserted in PostgreSQL's ON CONFLICT clause
      await db
        .insert(schema.keyValueStore)
        .values(values)
        .onConflictDoUpdate({
          target: schema.keyValueStore.key,
          set: {
            value: sql`EXCLUDED.value`,
            updated_at: now,
          },
        });

      return Ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to set entries: ${errorMessage}`);
    }
  }

  async delete(keys: string[]): Promise<Result<void, string>> {
    try {
      const db = await this.getDb();

      // Handle empty keys array
      if (keys.length === 0) {
        return Ok(undefined);
      }

      // Remove duplicates
      const uniqueKeys = Array.from(new Set(keys));

      // Delete keys (succeeds even if keys don't exist)
      await db.delete(schema.keyValueStore).where(inArray(schema.keyValueStore.key, uniqueKeys));

      return Ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to delete keys: ${errorMessage}`);
    }
  }
}
