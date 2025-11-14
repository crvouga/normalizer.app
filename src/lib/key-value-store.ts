import type { Result } from './result';

/**
 * Key-value store interface with minimal bulk operations.
 * All methods operate on multiple keys/entries at once for efficiency.
 */
export interface KeyValueStore {
  /**
   * Get multiple keys at once.
   * Returns a Map where keys map to their values, or null if the key doesn't exist.
   */
  get(keys: string[]): Promise<Result<Map<string, string | null>, string>>;

  /**
   * Set multiple key-value pairs at once.
   * Overwrites existing keys if they already exist.
   */
  set(entries: Record<string, string>): Promise<Result<void, string>>;

  /**
   * Delete multiple keys at once.
   * Succeeds even if some keys don't exist.
   */
  delete(keys: string[]): Promise<Result<void, string>>;
}
