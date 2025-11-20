import { describe, expect, test, beforeEach, beforeAll } from 'bun:test';
import { createLogger } from '../logger';
import { createS3 } from '../../shared/s3';
import { createMinioClient } from '../minio/minio-client';
import { getS3Config } from '../../shared/s3-config';
import { isOk } from '../result';
import type { ObjectStore } from './object-store';
import { S3ObjectStore } from './object-store-s3';

describe('ObjectStore (S3 implementation)', () => {
  const logger = createLogger();
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey } = getS3Config();
  const minioClient = createMinioClient({
    minioEndpoint: s3Endpoint,
    accessKey: s3AccessKeyId,
    secretKey: s3SecretAccessKey,
    logger,
  });
  const testBucket = 'test';
  let store: ObjectStore;

  beforeAll(async () => {
    await minioClient.ensureBucketExists(testBucket);
  });

  beforeEach(async () => {
    const { s3Client } = await createS3({ logger });
    store = new S3ObjectStore(s3Client);
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
      'key with spaces',
    ];
    for (const key of testKeys) {
      const existsResult = await store.exists({ bucket: testBucket, key });
      if (isOk(existsResult) && existsResult.value) {
        await store.delete({ bucket: testBucket, key });
      }
    }
  });

  // READ TESTS
  test('read: returns error for non-existent object', async () => {
    const result = await store.read({ bucket: testBucket, key: 'non-existent-key' });
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error).toBeDefined();
      expect(typeof result.error).toBe('string');
    }
  });

  test('read: reads existing object', async () => {
    const testData = Buffer.from('Hello, World!');
    const writeResult = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: testData,
    });
    expect(isOk(writeResult)).toBe(true);

    const readResult = await store.read({ bucket: testBucket, key: 'key1' });
    expect(isOk(readResult)).toBe(true);
    if (isOk(readResult)) {
      expect(readResult.value).toEqual(testData);
      expect(readResult.value.toString()).toBe('Hello, World!');
    }
  });

  test('read: reads binary data correctly', async () => {
    const testData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
    const writeResult = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: testData,
    });
    expect(isOk(writeResult)).toBe(true);

    const readResult = await store.read({ bucket: testBucket, key: 'key1' });
    expect(isOk(readResult)).toBe(true);
    if (isOk(readResult)) {
      expect(readResult.value).toEqual(testData);
      expect(Array.from(readResult.value)).toEqual([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
    }
  });

  test('read: reads empty buffer', async () => {
    const testData = Buffer.alloc(0);
    const writeResult = await store.write({
      bucket: testBucket,
      key: 'emptyKey',
      data: testData,
    });
    expect(isOk(writeResult)).toBe(true);

    const readResult = await store.read({ bucket: testBucket, key: 'emptyKey' });
    expect(isOk(readResult)).toBe(true);
    if (isOk(readResult)) {
      expect(readResult.value).toEqual(testData);
      expect(readResult.value.length).toBe(0);
    }
  });

  test('read: reads large data correctly', async () => {
    const testData = Buffer.alloc(1024 * 1024, 0x42); // 1MB of 0x42
    const writeResult = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: testData,
    });
    expect(isOk(writeResult)).toBe(true);

    const readResult = await store.read({ bucket: testBucket, key: 'key1' });
    expect(isOk(readResult)).toBe(true);
    if (isOk(readResult)) {
      expect(readResult.value.length).toBe(1024 * 1024);
      expect(readResult.value[0]).toBe(0x42);
      expect(readResult.value[readResult.value.length - 1]).toBe(0x42);
    }
  });

  // WRITE TESTS
  test('write: writes single object', async () => {
    const testData = Buffer.from('test data');
    const result = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: testData,
    });
    expect(isOk(result)).toBe(true);

    const readResult = await store.read({ bucket: testBucket, key: 'key1' });
    expect(isOk(readResult)).toBe(true);
    if (isOk(readResult)) {
      expect(readResult.value).toEqual(testData);
    }
  });

  test('write: overwrites existing object', async () => {
    const initialData = Buffer.from('initial');
    const writeResult1 = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: initialData,
    });
    expect(isOk(writeResult1)).toBe(true);

    const updatedData = Buffer.from('updated');
    const writeResult2 = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: updatedData,
    });
    expect(isOk(writeResult2)).toBe(true);

    const readResult = await store.read({ bucket: testBucket, key: 'key1' });
    expect(isOk(readResult)).toBe(true);
    if (isOk(readResult)) {
      expect(readResult.value).toEqual(updatedData);
      expect(readResult.value.toString()).toBe('updated');
    }
  });

  test('write: writes with contentType', async () => {
    const testData = Buffer.from('{"key": "value"}');
    const result = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: testData,
      contentType: 'application/json',
    });
    expect(isOk(result)).toBe(true);

    const readResult = await store.read({ bucket: testBucket, key: 'key1' });
    expect(isOk(readResult)).toBe(true);
    if (isOk(readResult)) {
      expect(readResult.value).toEqual(testData);
    }
  });

  test('write: writes empty buffer', async () => {
    const testData = Buffer.alloc(0);
    const result = await store.write({
      bucket: testBucket,
      key: 'emptyKey',
      data: testData,
    });
    expect(isOk(result)).toBe(true);

    const readResult = await store.read({ bucket: testBucket, key: 'emptyKey' });
    expect(isOk(readResult)).toBe(true);
    if (isOk(readResult)) {
      expect(readResult.value.length).toBe(0);
    }
  });

  test('write: handles special characters in keys', async () => {
    const testData = Buffer.from('test data');
    const specialKeys = [
      'key.with.dots',
      'key-with-dashes',
      'key_with_underscores',
      'key/slash',
      'key with spaces',
    ];

    for (const key of specialKeys) {
      const writeResult = await store.write({
        bucket: testBucket,
        key,
        data: testData,
      });
      expect(isOk(writeResult)).toBe(true);

      const readResult = await store.read({ bucket: testBucket, key });
      expect(isOk(readResult)).toBe(true);
      if (isOk(readResult)) {
        expect(readResult.value).toEqual(testData);
      }
    }
  });

  // EXISTS TESTS
  test('exists: returns false for non-existent object', async () => {
    const result = await store.exists({ bucket: testBucket, key: 'non-existent-key' });
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe(false);
    }
  });

  test('exists: returns true for existing object', async () => {
    const testData = Buffer.from('test data');
    const writeResult = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: testData,
    });
    expect(isOk(writeResult)).toBe(true);

    const existsResult = await store.exists({ bucket: testBucket, key: 'key1' });
    expect(isOk(existsResult)).toBe(true);
    if (isOk(existsResult)) {
      expect(existsResult.value).toBe(true);
    }
  });

  test('exists: returns false after deletion', async () => {
    const testData = Buffer.from('test data');
    const writeResult = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: testData,
    });
    expect(isOk(writeResult)).toBe(true);

    const deleteResult = await store.delete({ bucket: testBucket, key: 'key1' });
    expect(isOk(deleteResult)).toBe(true);

    const existsResult = await store.exists({ bucket: testBucket, key: 'key1' });
    expect(isOk(existsResult)).toBe(true);
    if (isOk(existsResult)) {
      expect(existsResult.value).toBe(false);
    }
  });

  // DELETE TESTS
  test('delete: deletes existing object', async () => {
    const testData = Buffer.from('test data');
    const writeResult = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: testData,
    });
    expect(isOk(writeResult)).toBe(true);

    const deleteResult = await store.delete({ bucket: testBucket, key: 'key1' });
    expect(isOk(deleteResult)).toBe(true);

    const existsResult = await store.exists({ bucket: testBucket, key: 'key1' });
    expect(isOk(existsResult)).toBe(true);
    if (isOk(existsResult)) {
      expect(existsResult.value).toBe(false);
    }
  });

  test('delete: succeeds when deleting non-existent object', async () => {
    const result = await store.delete({ bucket: testBucket, key: 'non-existent-key' });
    expect(isOk(result)).toBe(true);
  });

  test('delete: only deletes specified object', async () => {
    const testData1 = Buffer.from('data1');
    const testData2 = Buffer.from('data2');
    const testData3 = Buffer.from('data3');

    await store.write({ bucket: testBucket, key: 'key1', data: testData1 });
    await store.write({ bucket: testBucket, key: 'key2', data: testData2 });
    await store.write({ bucket: testBucket, key: 'key3', data: testData3 });

    const deleteResult = await store.delete({ bucket: testBucket, key: 'key1' });
    expect(isOk(deleteResult)).toBe(true);

    const exists1 = await store.exists({ bucket: testBucket, key: 'key1' });
    const exists2 = await store.exists({ bucket: testBucket, key: 'key2' });
    const exists3 = await store.exists({ bucket: testBucket, key: 'key3' });

    if (isOk(exists1)) expect(exists1.value).toBe(false);
    if (isOk(exists2)) expect(exists2.value).toBe(true);
    if (isOk(exists3)) expect(exists3.value).toBe(true);
  });

  // INTEGRATION TEST
  test('integration: handles complete workflow: write, read, exists, delete', async () => {
    // Write initial object
    const testData1 = Buffer.from('initial data');
    const writeResult1 = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: testData1,
    });
    expect(isOk(writeResult1)).toBe(true);

    // Verify it exists
    const existsResult1 = await store.exists({ bucket: testBucket, key: 'key1' });
    expect(isOk(existsResult1)).toBe(true);
    if (isOk(existsResult1)) {
      expect(existsResult1.value).toBe(true);
    }

    // Read it
    const readResult1 = await store.read({ bucket: testBucket, key: 'key1' });
    expect(isOk(readResult1)).toBe(true);
    if (isOk(readResult1)) {
      expect(readResult1.value).toEqual(testData1);
    }

    // Overwrite it
    const testData2 = Buffer.from('updated data');
    const writeResult2 = await store.write({
      bucket: testBucket,
      key: 'key1',
      data: testData2,
    });
    expect(isOk(writeResult2)).toBe(true);

    // Read updated data
    const readResult2 = await store.read({ bucket: testBucket, key: 'key1' });
    expect(isOk(readResult2)).toBe(true);
    if (isOk(readResult2)) {
      expect(readResult2.value).toEqual(testData2);
    }

    // Delete it
    const deleteResult = await store.delete({ bucket: testBucket, key: 'key1' });
    expect(isOk(deleteResult)).toBe(true);

    // Verify it no longer exists
    const existsResult2 = await store.exists({ bucket: testBucket, key: 'key1' });
    expect(isOk(existsResult2)).toBe(true);
    if (isOk(existsResult2)) {
      expect(existsResult2.value).toBe(false);
    }

    // Verify read fails
    const readResult3 = await store.read({ bucket: testBucket, key: 'key1' });
    expect(isOk(readResult3)).toBe(false);
  });
});
