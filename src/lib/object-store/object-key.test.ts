import { describe, expect, test } from 'bun:test';
import {
  applyStoreKeyPrefix,
  enforceKeyPrefix,
  fullStoreKeyPrefix,
  objectKey,
  OBJECT_KEY_PREFIX,
  validateStoreNamespace,
} from './object-key';

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

describe('validateStoreNamespace', () => {
  test('accepts valid namespace', () => {
    expect(() => validateStoreNamespace('prd')).not.toThrow();
    expect(() => validateStoreNamespace('test-normalization-task')).not.toThrow();
  });

  test('rejects invalid namespace', () => {
    expect(() => validateStoreNamespace('')).toThrow();
    expect(() => validateStoreNamespace('a/b')).toThrow();
    expect(() => validateStoreNamespace('..')).toThrow();
  });
});

describe('fullStoreKeyPrefix', () => {
  test('composes global and store namespace', () => {
    expect(fullStoreKeyPrefix('prd')).toBe(`${OBJECT_KEY_PREFIX}/prd`);
  });
});

describe('applyStoreKeyPrefix', () => {
  test('inserts store namespace after global prefix', () => {
    expect(String(applyStoreKeyPrefix('artifacts/file.csv', 'prd'))).toBe(
      `${OBJECT_KEY_PREFIX}/prd/artifacts/file.csv`,
    );
  });

  test('is idempotent when namespace already present', () => {
    const physical = `${OBJECT_KEY_PREFIX}/prd/artifacts/file.csv`;
    expect(String(applyStoreKeyPrefix(physical, 'prd'))).toBe(physical);
  });

  test('handles logical keys that already include global prefix', () => {
    const logical = `${OBJECT_KEY_PREFIX}/artifacts/file.csv`;
    expect(String(applyStoreKeyPrefix(logical, 'test-ns'))).toBe(
      `${OBJECT_KEY_PREFIX}/test-ns/artifacts/file.csv`,
    );
  });
});
