import { describe, expect, test } from 'bun:test';
import { enforceKeyPrefix, objectKey, OBJECT_KEY_PREFIX } from './object-key';

describe('objectKey', () => {
  test('prepends the app prefix', () => {
    const key = objectKey('artifacts', 'abc', 'file.csv');
    expect(String(key)).toBe(`${OBJECT_KEY_PREFIX}/artifacts/abc/file.csv`);
  });

  test('is idempotent when prefix segment is included', () => {
    const key = objectKey('artifacts', 'abc', 'file.csv');
    expect(objectKey(OBJECT_KEY_PREFIX, 'artifacts', 'abc', 'file.csv')).toBe(key);
  });

  test('rejects traversal segments', () => {
    expect(() => objectKey('..', 'file.csv')).toThrow();
    expect(() => objectKey('artifacts', '..', 'file.csv')).toThrow();
  });

  test('rejects leading slash keys via enforceKeyPrefix', () => {
    expect(() => enforceKeyPrefix('/artifacts/file.csv')).toThrow();
  });

  test('enforceKeyPrefix prepends missing prefix', () => {
    expect(String(enforceKeyPrefix('artifacts/file.csv'))).toBe(
      `${OBJECT_KEY_PREFIX}/artifacts/file.csv`,
    );
  });
});
