import { z } from 'zod';
import { Ok, isErr, type Result } from '../result';
import type { KeyValueStore } from './key-value-store';

/**
 * Wrapper around a KeyValueStore that prefixes all keys with a given prefix array.
 * This allows multiple logical namespaces to share the same underlying store.
 * The prefix parts are joined by a colon.
 */
export class PrefixedKeyValueStore implements KeyValueStore {
  private store: KeyValueStore;
  private keyPrefixParts: string[];
  private keyPrefixString: string;

  constructor(config: { store: KeyValueStore; keyPrefix: string[] }) {
    this.store = config.store;
    this.keyPrefixParts = config.keyPrefix;
    this.keyPrefixString = this.keyPrefixParts.join(':');
  }

  /**
   * Adds the prefix to a key, using colon as the joiner.
   */
  private prefixKey(key: string): string {
    // Always add an extra colon between prefix and key if prefix exists
    return this.keyPrefixString.length > 0 ? `${this.keyPrefixString}:${key}` : key;
  }

  /**
   * Removes the prefix from a key.
   * Returns null if the key doesn't start with the prefix.
   */
  private unprefixKey(prefixedKey: string): string | null {
    const prefix = this.keyPrefixString;
    if (prefix.length === 0) {
      return prefixedKey;
    }
    if (!prefixedKey.startsWith(prefix + ':')) {
      return null;
    }
    return prefixedKey.slice(prefix.length + 1);
  }

  async get<T>(
    codec: z.ZodType<T>,
    keys: string[],
  ): Promise<Result<Record<string, T | null>, string>> {
    // Prefix all keys before querying the underlying store
    const prefixedKeys = keys.map((key) => this.prefixKey(key));

    // Get values from the underlying store
    const result = await this.store.get(codec, prefixedKeys);

    if (isErr(result)) {
      return result;
    }

    // Unprefix the keys in the result to return unprefixed keys to the caller
    const unprefixedResult: Record<string, T | null> = {};
    for (const [prefixedKey, value] of Object.entries(result.value)) {
      const unprefixedKey = this.unprefixKey(prefixedKey);
      if (unprefixedKey !== null) {
        unprefixedResult[unprefixedKey] = value;
      }
    }

    // Ensure all requested keys are present in the result (even if null)
    for (const key of keys) {
      if (!(key in unprefixedResult)) {
        unprefixedResult[key] = null;
      }
    }

    return Ok(unprefixedResult);
  }

  async set<T>(codec: z.ZodType<T>, entries: Record<string, T>): Promise<Result<void, string>> {
    // Prefix all keys before storing in the underlying store
    const prefixedEntries: Record<string, T> = {};
    for (const [key, value] of Object.entries(entries)) {
      prefixedEntries[this.prefixKey(key)] = value;
    }

    return this.store.set(codec, prefixedEntries);
  }

  async zap(keys: string[]): Promise<Result<void, string>> {
    // Prefix all keys before deleting from the underlying store
    const prefixedKeys = keys.map((key) => this.prefixKey(key));

    return this.store.zap(prefixedKeys);
  }
}
