import { describe, expect, test } from 'bun:test';
import type { KeyValueStore } from './key-value-store';
import { isOk } from './result';

/**
 * Test suite for KeyValueStore interface.
 * Tests the interface contract without exposing implementation details.
 *
 * @param createTestStore - Factory function that creates a fresh KeyValueStore instance for testing
 */
export function keyValueStoreTestSuite(createTestStore: () => KeyValueStore) {
  describe('KeyValueStore interface', () => {
    describe('get', () => {
      test('should return empty map for empty keys array', async () => {
        const store = createTestStore();
        const result = await store.get([]);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.size).toBe(0);
        }
      });

      test('should return null for non-existent keys', async () => {
        const store = createTestStore();
        const result = await store.get(['non-existent-key']);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.get('non-existent-key')).toBe(null);
        }
      });

      test('should return null for multiple non-existent keys', async () => {
        const store = createTestStore();
        const result = await store.get(['key1', 'key2', 'key3']);

        expect(isOk(result)).toBe(true);
        if (isOk(result)) {
          expect(result.value.get('key1')).toBe(null);
          expect(result.value.get('key2')).toBe(null);
          expect(result.value.get('key3')).toBe(null);
        }
      });

      test('should return values for existing keys', async () => {
        const store = createTestStore();

        // Set some values
        const setResult = await store.set({
          key1: 'value1',
          key2: 'value2',
        });
        expect(isOk(setResult)).toBe(true);

        // Get them back
        const getResult = await store.get(['key1', 'key2']);

        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('key1')).toBe('value1');
          expect(getResult.value.get('key2')).toBe('value2');
        }
      });

      test('should return mix of existing and non-existent keys', async () => {
        const store = createTestStore();

        // Set one key
        const setResult = await store.set({ key1: 'value1' });
        expect(isOk(setResult)).toBe(true);

        // Get mix of existing and non-existent
        const getResult = await store.get(['key1', 'non-existent']);

        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('key1')).toBe('value1');
          expect(getResult.value.get('non-existent')).toBe(null);
        }
      });

      test('should return empty string as valid value', async () => {
        const store = createTestStore();

        const setResult = await store.set({ emptyKey: '' });
        expect(isOk(setResult)).toBe(true);

        const getResult = await store.get(['emptyKey']);

        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('emptyKey')).toBe('');
        }
      });

      test('should handle duplicate keys in get request', async () => {
        const store = createTestStore();

        const setResult = await store.set({ key1: 'value1' });
        expect(isOk(setResult)).toBe(true);

        const getResult = await store.get(['key1', 'key1', 'key1']);

        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          // Should return the value for each key (even if duplicates in request)
          expect(getResult.value.get('key1')).toBe('value1');
          expect(getResult.value.size).toBe(1); // Only one unique key
        }
      });
    });

    describe('set', () => {
      test('should set single key-value pair', async () => {
        const store = createTestStore();
        const result = await store.set({ key1: 'value1' });

        expect(isOk(result)).toBe(true);

        // Verify it was set
        const getResult = await store.get(['key1']);
        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('key1')).toBe('value1');
        }
      });

      test('should set multiple key-value pairs', async () => {
        const store = createTestStore();
        const result = await store.set({
          key1: 'value1',
          key2: 'value2',
          key3: 'value3',
        });

        expect(isOk(result)).toBe(true);

        // Verify all were set
        const getResult = await store.get(['key1', 'key2', 'key3']);
        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('key1')).toBe('value1');
          expect(getResult.value.get('key2')).toBe('value2');
          expect(getResult.value.get('key3')).toBe('value3');
        }
      });

      test('should overwrite existing keys', async () => {
        const store = createTestStore();

        // Set initial value
        const setResult1 = await store.set({ key1: 'initial' });
        expect(isOk(setResult1)).toBe(true);

        // Overwrite it
        const setResult2 = await store.set({ key1: 'updated' });
        expect(isOk(setResult2)).toBe(true);

        // Verify it was overwritten
        const getResult = await store.get(['key1']);
        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('key1')).toBe('updated');
        }
      });

      test('should handle empty object', async () => {
        const store = createTestStore();
        const result = await store.set({});

        expect(isOk(result)).toBe(true);
      });

      test('should set empty string as valid value', async () => {
        const store = createTestStore();
        const result = await store.set({ emptyKey: '' });

        expect(isOk(result)).toBe(true);

        const getResult = await store.get(['emptyKey']);
        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('emptyKey')).toBe('');
        }
      });

      test('should handle special characters in keys and values', async () => {
        const store = createTestStore();
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
    });

    describe('delete', () => {
      test('should delete single key', async () => {
        const store = createTestStore();

        // Set a key
        const setResult = await store.set({ key1: 'value1' });
        expect(isOk(setResult)).toBe(true);

        // Delete it
        const deleteResult = await store.delete(['key1']);
        expect(isOk(deleteResult)).toBe(true);

        // Verify it's gone
        const getResult = await store.get(['key1']);
        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('key1')).toBe(null);
        }
      });

      test('should delete multiple keys', async () => {
        const store = createTestStore();

        // Set multiple keys
        const setResult = await store.set({
          key1: 'value1',
          key2: 'value2',
          key3: 'value3',
        });
        expect(isOk(setResult)).toBe(true);

        // Delete them
        const deleteResult = await store.delete(['key1', 'key2', 'key3']);
        expect(isOk(deleteResult)).toBe(true);

        // Verify they're gone
        const getResult = await store.get(['key1', 'key2', 'key3']);
        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('key1')).toBe(null);
          expect(getResult.value.get('key2')).toBe(null);
          expect(getResult.value.get('key3')).toBe(null);
        }
      });

      test('should succeed when deleting non-existent keys', async () => {
        const store = createTestStore();
        const result = await store.delete(['non-existent-key']);

        expect(isOk(result)).toBe(true);
      });

      test('should succeed when deleting mix of existing and non-existent keys', async () => {
        const store = createTestStore();

        // Set one key
        const setResult = await store.set({ key1: 'value1' });
        expect(isOk(setResult)).toBe(true);

        // Delete mix
        const deleteResult = await store.delete(['key1', 'non-existent']);
        expect(isOk(deleteResult)).toBe(true);

        // Verify existing key is gone
        const getResult = await store.get(['key1']);
        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('key1')).toBe(null);
        }
      });

      test('should handle empty array', async () => {
        const store = createTestStore();
        const result = await store.delete([]);

        expect(isOk(result)).toBe(true);
      });

      test('should only delete specified keys', async () => {
        const store = createTestStore();

        // Set multiple keys
        const setResult = await store.set({
          key1: 'value1',
          key2: 'value2',
          key3: 'value3',
        });
        expect(isOk(setResult)).toBe(true);

        // Delete only one
        const deleteResult = await store.delete(['key1']);
        expect(isOk(deleteResult)).toBe(true);

        // Verify only key1 is gone
        const getResult = await store.get(['key1', 'key2', 'key3']);
        expect(isOk(getResult)).toBe(true);
        if (isOk(getResult)) {
          expect(getResult.value.get('key1')).toBe(null);
          expect(getResult.value.get('key2')).toBe('value2');
          expect(getResult.value.get('key3')).toBe('value3');
        }
      });
    });

    describe('integration', () => {
      test('should handle complete workflow: set, get, update, delete', async () => {
        const store = createTestStore();

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
  });
}
