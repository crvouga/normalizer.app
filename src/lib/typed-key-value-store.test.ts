import { describe, expect, test, beforeEach, beforeAll, afterAll } from 'bun:test';
import { z } from 'zod';
import { createDb, cleanupDb } from '../shared/db';
import { createLogger } from './logger';
import { isOk } from './result';
import { PostgresKeyValueStore } from './key-value-store/key-value-store-postgres';
import { TypedKeyValueStore } from './typed-key-value-store';
import type { Db } from '../shared/db';

describe('TypedKeyValueStore', () => {
  const logger = createLogger();
  let db: Db;
  let baseStore: PostgresKeyValueStore;
  const stringCodec = z.string();
  const numberCodec = z.number();
  const userSchema = z.object({
    name: z.string(),
    age: z.number(),
    email: z.string().email(),
  });

  beforeAll(async () => {
    db = await createDb({ logger });
  });

  afterAll(async () => {
    await cleanupDb(logger);
  });

  beforeEach(async () => {
    baseStore = new PostgresKeyValueStore({ db });
    // Clean up test data
    const testKeys = ['key1', 'key2', 'user1', 'user2', 'num1', 'num2'];
    await baseStore.delete(testKeys);
  });

  test('get: returns typed values without passing codec', async () => {
    const typedStore = new TypedKeyValueStore({ store: baseStore, codec: stringCodec });

    // Set values using the typed store
    const setResult = await typedStore.set({ key1: 'value1', key2: 'value2' });
    expect(isOk(setResult)).toBe(true);

    // Get values - no need to pass codec
    const getResult = await typedStore.get(['key1', 'key2']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value['key1']).toBe('value1');
      expect(getResult.value['key2']).toBe('value2');
      // TypeScript knows these are strings
      expect(typeof getResult.value['key1']).toBe('string');
    }
  });

  test('set: validates values using bound codec', async () => {
    const typedStore = new TypedKeyValueStore({ store: baseStore, codec: numberCodec });

    // Valid number values
    const setResult = await typedStore.set({ num1: 42, num2: 100 });
    expect(isOk(setResult)).toBe(true);

    const getResult = await typedStore.get(['num1', 'num2']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value['num1']).toBe(42);
      expect(getResult.value['num2']).toBe(100);
      expect(typeof getResult.value['num1']).toBe('number');
    }
  });

  test('set: returns error when validation fails', async () => {
    const typedStore = new TypedKeyValueStore({ store: baseStore, codec: numberCodec });

    // Try to set invalid value (string instead of number)
    const setResult = await typedStore.set({ num1: 'not a number' as unknown as number });
    expect(isOk(setResult)).toBe(false);
    if (!isOk(setResult)) {
      expect(setResult.error).toContain('Validation failed');
    }
  });

  test('works with complex object schemas', async () => {
    const typedStore = new TypedKeyValueStore({ store: baseStore, codec: userSchema });

    const users = {
      user1: { name: 'Alice', age: 30, email: 'alice@example.com' },
      user2: { name: 'Bob', age: 25, email: 'bob@example.com' },
    };

    const setResult = await typedStore.set(users);
    expect(isOk(setResult)).toBe(true);

    const getResult = await typedStore.get(['user1', 'user2']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value['user1']).toEqual(users.user1);
      expect(getResult.value['user2']).toEqual(users.user2);
      // TypeScript knows the structure
      if (getResult.value['user1']) {
        expect(getResult.value['user1'].name).toBe('Alice');
        expect(getResult.value['user1'].age).toBe(30);
      }
    }
  });

  test('set: returns error when object schema validation fails', async () => {
    const typedStore = new TypedKeyValueStore({ store: baseStore, codec: userSchema });

    // Invalid email
    const setResult = await typedStore.set({
      user1: { name: 'Alice', age: 30, email: 'invalid-email' },
    });
    expect(isOk(setResult)).toBe(false);
    if (!isOk(setResult)) {
      expect(setResult.error).toContain('Validation failed');
    }
  });

  test('delete: works without codec parameter', async () => {
    const typedStore = new TypedKeyValueStore({ store: baseStore, codec: stringCodec });

    await typedStore.set({ key1: 'value1', key2: 'value2' });

    const deleteResult = await typedStore.delete(['key1']);
    expect(isOk(deleteResult)).toBe(true);

    const getResult = await typedStore.get(['key1', 'key2']);
    expect(isOk(getResult)).toBe(true);
    if (isOk(getResult)) {
      expect(getResult.value['key1']).toBe(null);
      expect(getResult.value['key2']).toBe('value2');
    }
  });

  test('multiple typed stores can use different schemas', async () => {
    const stringStore = new TypedKeyValueStore({ store: baseStore, codec: stringCodec });
    const numberStore = new TypedKeyValueStore({ store: baseStore, codec: numberCodec });

    await stringStore.set({ key1: 'hello' });
    await numberStore.set({ num1: 42 });

    const stringResult = await stringStore.get(['key1']);
    const numberResult = await numberStore.get(['num1']);

    expect(isOk(stringResult)).toBe(true);
    expect(isOk(numberResult)).toBe(true);

    if (isOk(stringResult) && isOk(numberResult)) {
      expect(stringResult.value['key1']).toBe('hello');
      expect(numberResult.value['num1']).toBe(42);
    }
  });

  test('get: returns error when stored value fails parsing with bound codec', async () => {
    // Store a number using number codec
    const numberStore = new TypedKeyValueStore({ store: baseStore, codec: numberCodec });
    const setResult = await numberStore.set({ testKey: 42 });
    expect(isOk(setResult)).toBe(true);

    // Try to get it with string codec - should fail
    const stringStore = new TypedKeyValueStore({ store: baseStore, codec: stringCodec });
    const getResult = await stringStore.get(['testKey']);
    expect(isOk(getResult)).toBe(false);
    if (!isOk(getResult)) {
      expect(getResult.error).toContain('Failed to parse value for key');
    }

    // Clean up
    await baseStore.delete(['testKey']);
  });
});
