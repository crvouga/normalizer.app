import type { z } from 'zod';
import type { Result } from '../result';

/**
 * Key-value store interface with minimal bulk operations.
 * All methods operate on multiple keys/entries at once for efficiency.
 * Uses zod schemas for type-safe encoding and decoding of values.
 */
export interface KeyValueStore {
  /**
   * Get multiple keys at once.
   * Returns a plain object where keys map to their parsed values, or null if the key doesn't exist.
   * @param codec Zod schema for parsing stored values
   * @param keys Array of keys to retrieve
   * @returns Result containing a Record mapping keys to parsed values (or null if not found)
   */
  get<T>(codec: z.ZodType<T>, keys: string[]): Promise<Result<Record<string, T | null>, string>>;

  /**
   * Set multiple key-value pairs at once.
   * Overwrites existing keys if they already exist.
   * Values are validated using the codec and stored as JSON strings.
   * @param codec Zod schema for validating values before storage
   * @param entries Record of key-value pairs to store
   * @returns Result indicating success or failure
   */
  set<T>(codec: z.ZodType<T>, entries: Record<string, T>): Promise<Result<void, string>>;

  /**
   * Delete multiple keys at once.
   * Succeeds even if some keys don't exist.
   * @param keys Array of keys to delete
   * @returns Result indicating success or failure
   */
  delete(keys: string[]): Promise<Result<void, string>>;
}
