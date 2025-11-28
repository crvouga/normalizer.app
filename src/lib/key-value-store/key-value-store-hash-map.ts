import { z } from 'zod';
import type { KeyValueStore } from './key-value-store';
import { Ok, Err, type Result } from '../result';

/**
 * In-memory hash map implementation of KeyValueStore.
 * Uses a JavaScript Map to store key-value pairs, with values stored as JSON strings.
 * Useful for testing, caching, or when persistence is not required.
 */
export class HashMapKeyValueStore implements KeyValueStore {
  private store: Map<string, string>;

  constructor() {
    this.store = new Map<string, string>();
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

      // Build result object by looking up each key in the map
      const result: Record<string, T | null> = {};
      for (const key of uniqueKeys) {
        const rawValue = this.store.get(key);
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

      // Store each entry in the map as a JSON string
      for (const [key, value] of Object.entries(entries)) {
        this.store.set(key, JSON.stringify(value));
      }

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

      // Delete keys from the map (succeeds even if keys don't exist)
      for (const key of uniqueKeys) {
        this.store.delete(key);
      }

      return Ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to delete keys: ${errorMessage}`);
    }
  }
}
