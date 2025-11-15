import { inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Tx } from '../sql';
import * as schema from '../db/schema';
import type { KeyValueStore } from './key-value-store';
import { Ok, Err, type Result } from './result';

/**
 * Postgres implementation of KeyValueStore using the key_value_store table.
 * Can be used with either a Db instance or a Tx (transaction) for transaction support.
 */
export class PostgresKeyValueStore implements KeyValueStore {
  private db: Db | Tx;

  constructor(db: Db | Tx) {
    this.db = db;
  }

  async get<T>(
    codec: z.ZodType<T>,
    keys: string[],
  ): Promise<Result<Record<string, T | null>, string>> {
    try {
      // Handle empty keys array
      if (keys.length === 0) {
        return Ok({});
      }

      // Remove duplicates for efficient querying
      const uniqueKeys = Array.from(new Set(keys));

      // Query database for existing keys
      const rows = await this.db
        .select()
        .from(schema.keyValueStore)
        .where(inArray(schema.keyValueStore.key, uniqueKeys));

      // Create a map of found keys with their raw string values
      const foundMap = new Map<string, string>();
      for (const row of rows) {
        foundMap.set(row.key, row.value);
      }

      // Parse each value using the codec and build result object
      const result: Record<string, T | null> = {};
      for (const key of uniqueKeys) {
        const rawValue = foundMap.get(key);
        if (rawValue === undefined) {
          // Key not found
          result[key] = null;
        } else {
          // Parse the JSON string and validate with codec
          try {
            const parsed = JSON.parse(rawValue);
            const parseResult = codec.safeParse(parsed);
            if (parseResult.success) {
              result[key] = parseResult.data;
            } else {
              // Parsing failed - return error for type safety
              return Err(`Failed to parse value for key "${key}": ${parseResult.error.message}`);
            }
          } catch (jsonError) {
            // JSON parsing failed
            const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
            return Err(`Failed to parse JSON for key "${key}": ${errorMessage}`);
          }
        }
      }

      return Ok(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to get keys: ${errorMessage}`);
    }
  }

  async set<T>(codec: z.ZodType<T>, entries: Record<string, T>): Promise<Result<void, string>> {
    try {
      // Handle empty entries
      if (Object.keys(entries).length === 0) {
        return Ok(undefined);
      }

      // Validate all entries using the codec before storing
      const validationErrors: string[] = [];
      for (const [key, value] of Object.entries(entries)) {
        const parseResult = codec.safeParse(value);
        if (!parseResult.success) {
          validationErrors.push(`Key "${key}": ${parseResult.error.message}`);
        }
      }

      if (validationErrors.length > 0) {
        return Err(`Validation failed: ${validationErrors.join('; ')}`);
      }

      // Convert entries to array of values for bulk insert
      // Values are stored as JSON strings
      const now = new Date();
      const values = Object.entries(entries).map(([key, value]) => ({
        key,
        value: JSON.stringify(value),
        updated_at: now,
      }));

      // Use upsert (insert with conflict resolution) to handle overwrites
      // EXCLUDED references the row being inserted in PostgreSQL's ON CONFLICT clause
      await this.db
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
      // Handle empty keys array
      if (keys.length === 0) {
        return Ok(undefined);
      }

      // Remove duplicates
      const uniqueKeys = Array.from(new Set(keys));

      // Delete keys (succeeds even if keys don't exist)
      await this.db
        .delete(schema.keyValueStore)
        .where(inArray(schema.keyValueStore.key, uniqueKeys));

      return Ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to delete keys: ${errorMessage}`);
    }
  }
}
