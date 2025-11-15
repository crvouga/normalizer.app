import { describe, expect, test, beforeEach } from 'bun:test';
import { isOk } from './result';

import type { KeyValueStore } from './key-value-store';
import { PostgresKeyValueStore } from './key-value-store-postgres';

class Fixture {
  store: KeyValueStore;

  constructor() {
    this.store = new PostgresKeyValueStore();
  }

  getStore() {
    return this.store;
  }
}

describe('KeyValueStore (Postgres implementation)', () => {
  let fixture: Fixture;
  let store: KeyValueStore;

  beforeEach(async () => {
    fixture = new Fixture();
    store = fixture.getStore();
    // Clean up any leftover test data before each test
    // Delete common test keys that might exist from previous test runs
    const testKeys = [
      'key1',
      'key2',
      'key3',
      'non-existent-key',
      'non-existent',
      'emptyKey',
      'key.with.dots',
      'key-with-dashes',
      'key_with_underscores',
      'key/slash',
    ];
    await store.delete(testKeys);
  });

  // GET TESTS
  test('get: returns empty map for empty keys array', async () => {
    const result = await store.get([]);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.size).toBe(0);
    }
  });

  test('get: returns null for non-existent keys', async () => {
    const result = await store.get(['non-existent-key']);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.get('non-existent-key')).toBe(null);
    }
  });

  test('get: returns null for multiple non-existent keys', async () => {
    const result = await store.get(['key1', 'key2', 'key3']);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.get('key1')).toBe(null);
      expect(result.value.get('key2')).toBe(null);
      expect(result.value.get('key3')).toBe(null);
    }
  });

  test('get: returns values for existing keys', async () => {
    const setResult = await store.set({ key1: 'value1', key2: 'value2' });
    expect(isOk(setResult)).toBe(true);

    const getResult = await store.get(['key1', 'key2']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('key1')).toBe('value1');
      expect(getResult.value.get('key2')).toBe('value2');
    }
  });

  test('get: returns mix of existing and non-existent keys', async () => {
    const setResult = await store.set({ key1: 'value1' });
    expect(isOk(setResult)).toBe(true);

    const getResult = await store.get(['key1', 'non-existent']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('key1')).toBe('value1');
      expect(getResult.value.get('non-existent')).toBe(null);
    }
  });

  test('get: returns empty string as valid value', async () => {
    const setResult = await store.set({ emptyKey: '' });
    expect(isOk(setResult)).toBe(true);

    const getResult = await store.get(['emptyKey']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('emptyKey')).toBe('');
    }
  });

  test('get: handles duplicate keys in get request', async () => {
    const setResult = await store.set({ key1: 'value1' });
    expect(isOk(setResult)).toBe(true);

    const getResult = await store.get(['key1', 'key1', 'key1']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('key1')).toBe('value1');
      expect(getResult.value.size).toBe(1); // Only one unique key in map
    }
  });

  // SET TESTS
  test('set: sets single key-value pair', async () => {
    const result = await store.set({ key1: 'value1' });
    expect(isOk(result)).toBe(true);

    const getResult = await store.get(['key1']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('key1')).toBe('value1');
    }
  });

  test('set: sets multiple key-value pairs', async () => {
    const result = await store.set({
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    });
    expect(isOk(result)).toBe(true);

    const getResult = await store.get(['key1', 'key2', 'key3']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('key1')).toBe('value1');
      expect(getResult.value.get('key2')).toBe('value2');
      expect(getResult.value.get('key3')).toBe('value3');
    }
  });

  test('set: overwrites existing keys', async () => {
    const setResult1 = await store.set({ key1: 'initial' });
    expect(isOk(setResult1)).toBe(true);

    const setResult2 = await store.set({ key1: 'updated' });
    expect(isOk(setResult2)).toBe(true);

    const getResult = await store.get(['key1']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('key1')).toBe('updated');
    }
  });

  test('set: handles empty object', async () => {
    const result = await store.set({});
    expect(isOk(result)).toBe(true);
  });

  test('set: sets empty string as valid value', async () => {
    const result = await store.set({ emptyKey: '' });
    expect(isOk(result)).toBe(true);

    const getResult = await store.get(['emptyKey']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('emptyKey')).toBe('');
    }
  });

  test('set: handles special characters in keys and values', async () => {
    const specialEntries = {
      'key.with.dots': 'value with spaces',
      'key-with-dashes': 'value\nwith\nnewlines',
      key_with_underscores: 'value\twith\ttabs',
      'key/slash': 'value=equals',
    };

    const result = await store.set(specialEntries);
    expect(isOk(result)).toBe(true);

    const getResult = await store.get(Object.keys(specialEntries));
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      Object.entries(specialEntries).forEach(([key, value]) => {
        expect(getResult.value.get(key)).toBe(value);
      });
    }
  });

  // DELETE TESTS
  test('delete: deletes single key', async () => {
    const setResult = await store.set({ key1: 'value1' });
    expect(isOk(setResult)).toBe(true);

    const deleteResult = await store.delete(['key1']);
    expect(isOk(deleteResult)).toBe(true);

    const getResult = await store.get(['key1']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('key1')).toBe(null);
    }
  });

  test('delete: deletes multiple keys', async () => {
    const setResult = await store.set({
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    });
    expect(isOk(setResult)).toBe(true);

    const deleteResult = await store.delete(['key1', 'key2', 'key3']);
    expect(isOk(deleteResult)).toBe(true);

    const getResult = await store.get(['key1', 'key2', 'key3']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('key1')).toBe(null);
      expect(getResult.value.get('key2')).toBe(null);
      expect(getResult.value.get('key3')).toBe(null);
    }
  });

  test('delete: succeeds when deleting non-existent keys', async () => {
    const result = await store.delete(['non-existent-key']);
    expect(isOk(result)).toBe(true);
  });

  test('delete: succeeds when deleting mix of existing and non-existent keys', async () => {
    const setResult = await store.set({ key1: 'value1' });
    expect(isOk(setResult)).toBe(true);

    const deleteResult = await store.delete(['key1', 'non-existent']);
    expect(isOk(deleteResult)).toBe(true);

    const getResult = await store.get(['key1']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('key1')).toBe(null);
    }
  });

  test('delete: handles empty array', async () => {
    const result = await store.delete([]);
    expect(isOk(result)).toBe(true);
  });

  test('delete: only deletes specified keys', async () => {
    const setResult = await store.set({
      key1: 'value1',
      key2: 'value2',
      key3: 'value3',
    });
    expect(isOk(setResult)).toBe(true);

    const deleteResult = await store.delete(['key1']);
    expect(isOk(deleteResult)).toBe(true);

    const getResult = await store.get(['key1', 'key2', 'key3']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value.get('key1')).toBe(null);
      expect(getResult.value.get('key2')).toBe('value2');
      expect(getResult.value.get('key3')).toBe('value3');
    }
  });

  // INTEGRATION TEST
  test('integration: handles complete workflow: set, get, update, delete', async () => {
    // Set initial values
    const set1 = await store.set({
      key1: 'value1',
      key2: 'value2',
    });
    expect(isOk(set1)).toBe(true);

    // Get them
    const get1 = await store.get(['key1', 'key2']);
    expect(isOk(get1)).toBe(true);
    if (isOk(get1)) {
      expect(get1.value.get('key1')).toBe('value1');
      expect(get1.value.get('key2')).toBe('value2');
    }

    // Update one
    const set2 = await store.set({ key1: 'updated-value1' });
    expect(isOk(set2)).toBe(true);

    // Get updated values
    const get2 = await store.get(['key1', 'key2']);
    expect(isOk(get2)).toBe(true);
    if (isOk(get2)) {
      expect(get2.value.get('key1')).toBe('updated-value1');
      expect(get2.value.get('key2')).toBe('value2');
    }

    // Delete one
    const deleteResult = await store.delete(['key1']);
    expect(isOk(deleteResult)).toBe(true);

    // Verify final state
    const get3 = await store.get(['key1', 'key2']);
    expect(isOk(get3)).toBe(true);
    if (isOk(get3)) {
      expect(get3.value.get('key1')).toBe(null);
      expect(get3.value.get('key2')).toBe('value2');
    }
  });
});
