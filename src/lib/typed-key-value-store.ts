import type { z } from 'zod';
import type { KeyValueStore } from './key-value-store/key-value-store';
import type { Result } from './result';

/**
 * A type-safe wrapper around KeyValueStore that binds a zod schema at construction time.
 * This provides a more ergonomic API when you always use the same schema for a store instance.
 *
 * @example
 * ```ts
 * const userStore = new TypedKeyValueStore({
 *   store,
 *   codec: z.object({
 *     name: z.string(),
 *     age: z.number(),
 *   }),
 * });
 */
export class TypedKeyValueStore<T> {
  private readonly store: KeyValueStore;
  private readonly codec: z.ZodType<T>;

  /**
   * Creates a new TypedKeyValueStore instance.
   * @param store The underlying KeyValueStore implementation
   * @param codec The zod schema to use for all operations on this store
   */
  constructor(config: { store: KeyValueStore; codec: z.ZodType<T> }) {
    this.store = config.store;
    this.codec = config.codec;
  }

  /**
   * Get multiple keys at once.
   * Returns a plain object where keys map to their parsed values, or null if the key doesn't exist.
   * @param keys Array of keys to retrieve
   * @returns Result containing a Record mapping keys to parsed values (or null if not found)
   */
  get(keys: string[]): Promise<Result<Record<string, T | null>, string>> {
    return this.store.get(this.codec, keys);
  }

  /**
   * Set multiple key-value pairs at once.
   * Overwrites existing keys if they already exist.
   * Values are validated using the bound codec and stored as JSON strings.
   * @param entries Record of key-value pairs to store
   * @returns Result indicating success or failure
   */
  set(entries: Record<string, T>): Promise<Result<void, string>> {
    return this.store.set(this.codec, entries);
  }

  /**
   * Delete multiple keys at once.
   * Succeeds even if some keys don't exist.
   * @param keys Array of keys to delete
   * @returns Result indicating success or failure
   */
  delete(keys: string[]): Promise<Result<void, string>> {
    return this.store.delete(keys);
  }
}
