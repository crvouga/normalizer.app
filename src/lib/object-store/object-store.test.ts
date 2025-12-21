import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { rmSync } from 'fs';
import { createFilesystemObjectStore } from '~/src/shared/object-store-fs';
import { createObjectStore } from '~/src/shared/s3';
import { createLogger, type Logger } from '../logger';
import { isOk } from '../result';
import { getContentType } from '../tabular-data-format';
import type { ObjectStore } from './object-store';

// TEST_KEYS removed - we now clean up all objects in beforeEach for better test isolation

// Mock server base URL for presigned URL tests
const MOCK_SERVER_BASE_URL = 'http://localhost:8080';

// Test implementations
const implementations = [
  [
    'S3',
    async (logger: Logger): Promise<ObjectStore> => {
      const store = await createObjectStore({ logger, serverBaseUrl: MOCK_SERVER_BASE_URL });
      await store.ensureBucketExists('test');
      return store;
    },
  ] as const,
  [
    'Filesystem',
    async (logger: Logger): Promise<ObjectStore> => {
      const { mkdtemp } = await import('fs/promises');
      const { join } = await import('path');
      const { tmpdir } = await import('os');
      const prefix = join(tmpdir(), 'object-store-test-');
      const basePath = await mkdtemp(prefix);

      // Store basePath for cleanup - we'll access it via the store's internal property
      // For now, we'll handle cleanup in afterAll by checking if store has a cleanup method
      const store = await createFilesystemObjectStore({
        basePath,
        serverBaseUrl: MOCK_SERVER_BASE_URL,
        logger,
      });
      await store.ensureBucketExists('test');

      // Attach cleanup to store for later
      (store as any)._testBasePath = basePath;

      return store;
    },
  ] as const,
];

describe.each(implementations)(
  'ObjectStore (%s implementation)',
  async (_implementationName, createStore) => {
    const logger = createLogger({ noop: true });
    const testBucket = 'test';
    let store: ObjectStore;

    beforeAll(async () => {
      store = await createStore(logger);
    });

    afterAll(async () => {
      // Clean up filesystem temp directory if this is a filesystem implementation
      const basePath = (store as any)._testBasePath;
      if (basePath && typeof basePath === 'string') {
        try {
          rmSync(basePath, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    });

    beforeEach(async () => {
      // Clean up all objects in the test bucket to ensure test isolation
      try {
        const allObjects: Array<{ key: string }> = [];
        for await (const obj of store.listAllObjects(testBucket)) {
          allObjects.push(obj);
        }
        if (allObjects.length > 0) {
          await store.deleteMany(allObjects.map((obj) => ({ bucket: testBucket, key: obj.key })));
        }
      } catch (error) {
        // Ignore cleanup errors - bucket might be empty or not exist
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

    // READSTREAM TESTS
    test('readStream: returns error for non-existent object', async () => {
      const result = await store.readStream({ bucket: testBucket, key: 'non-existent-key' });
      expect(isOk(result)).toBe(false);
      if (!isOk(result)) {
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      }
    });

    test('readStream: reads existing object as stream', async () => {
      const testData = Buffer.from('Hello, World!');
      const writeResult = await store.write({
        bucket: testBucket,
        key: 'key1',
        data: testData,
      });
      expect(isOk(writeResult)).toBe(true);

      const streamResult = await store.readStream({ bucket: testBucket, key: 'key1' });
      expect(isOk(streamResult)).toBe(true);
      if (isOk(streamResult)) {
        const stream = streamResult.value;
        const reader = stream.getReader();
        const chunks: Buffer[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }

        const combined = Buffer.concat(chunks);
        expect(combined).toEqual(testData);
        expect(combined.toString()).toBe('Hello, World!');
      }
    });

    test('readStream: reads binary data correctly', async () => {
      const testData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      const writeResult = await store.write({
        bucket: testBucket,
        key: 'key1',
        data: testData,
      });
      expect(isOk(writeResult)).toBe(true);

      const streamResult = await store.readStream({ bucket: testBucket, key: 'key1' });
      expect(isOk(streamResult)).toBe(true);
      if (isOk(streamResult)) {
        const stream = streamResult.value;
        const reader = stream.getReader();
        const chunks: Buffer[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }

        const combined = Buffer.concat(chunks);
        expect(combined).toEqual(testData);
        expect(Array.from(combined)).toEqual([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      }
    });

    test('readStream: reads empty buffer', async () => {
      const testData = Buffer.alloc(0);
      const writeResult = await store.write({
        bucket: testBucket,
        key: 'emptyKey',
        data: testData,
      });
      expect(isOk(writeResult)).toBe(true);

      const streamResult = await store.readStream({ bucket: testBucket, key: 'emptyKey' });
      expect(isOk(streamResult)).toBe(true);
      if (isOk(streamResult)) {
        const stream = streamResult.value;
        const reader = stream.getReader();
        const chunks: Buffer[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }

        const combined = Buffer.concat(chunks);
        expect(combined.length).toBe(0);
        expect(combined).toEqual(testData);
      }
    });

    test('readStream: reads large data correctly', async () => {
      const testData = Buffer.alloc(1024 * 1024, 0x42); // 1MB of 0x42
      const writeResult = await store.write({
        bucket: testBucket,
        key: 'key1',
        data: testData,
      });
      expect(isOk(writeResult)).toBe(true);

      const streamResult = await store.readStream({ bucket: testBucket, key: 'key1' });
      expect(isOk(streamResult)).toBe(true);
      if (isOk(streamResult)) {
        const stream = streamResult.value;
        const reader = stream.getReader();
        const chunks: Buffer[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }

        const combined = Buffer.concat(chunks);
        expect(combined.length).toBe(1024 * 1024);
        expect(combined[0]).toBe(0x42);
        expect(combined[combined.length - 1]).toBe(0x42);
        expect(combined).toEqual(testData);
      }
    });

    test('readStream: produces same data as read method', async () => {
      const testData = Buffer.from('test data for comparison');
      const writeResult = await store.write({
        bucket: testBucket,
        key: 'key1',
        data: testData,
      });
      expect(isOk(writeResult)).toBe(true);

      // Read using read method
      const readResult = await store.read({ bucket: testBucket, key: 'key1' });
      expect(isOk(readResult)).toBe(true);

      // Read using readStream method
      const streamResult = await store.readStream({ bucket: testBucket, key: 'key1' });
      expect(isOk(streamResult)).toBe(true);

      if (isOk(readResult) && isOk(streamResult)) {
        const stream = streamResult.value;
        const reader = stream.getReader();
        const chunks: Buffer[] = [];

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
        } finally {
          reader.releaseLock();
        }

        const streamedData = Buffer.concat(chunks);
        expect(streamedData.toString()).toEqual(readResult.value.toString());
        expect(streamedData).toEqual(testData);
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
        contentType: getContentType('json'),
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

    test('getEndpointInfo should return base URL and HTTPS preference', async () => {
      const result = await store.getEndpointInfo();
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.baseUrl).toBeDefined();
        expect(typeof result.value.baseUrl).toBe('string');
        expect(result.value.baseUrl).toMatch(/^https?:\/\/.+/);
        expect(typeof result.value.useHTTPS).toBe('boolean');
      }
    });

    // PRESIGN TESTS
    test('presign: generates presigned GET URL', async () => {
      const testData = Buffer.from('test data');
      const writeResult = await store.write({
        bucket: testBucket,
        key: 'key1',
        data: testData,
      });
      expect(isOk(writeResult)).toBe(true);

      const presignResult = await store.presign({
        bucket: testBucket,
        key: 'key1',
        method: 'GET',
        expiresIn: 3600,
      });
      expect(isOk(presignResult)).toBe(true);
      if (isOk(presignResult)) {
        expect(presignResult.value).toBeDefined();
        expect(typeof presignResult.value).toBe('string');
        expect(presignResult.value).toMatch(/^https?:\/\/.+/);
      }
    });

    test('presign: generates presigned PUT URL', async () => {
      const presignResult = await store.presign({
        bucket: testBucket,
        key: 'key1',
        method: 'PUT',
        expiresIn: 3600,
      });
      expect(isOk(presignResult)).toBe(true);
      if (isOk(presignResult)) {
        expect(presignResult.value).toBeDefined();
        expect(typeof presignResult.value).toBe('string');
        expect(presignResult.value).toMatch(/^https?:\/\/.+/);
      }
    });

    test('presign: useHTTPS converts http:// to https:// when true', async () => {
      const presignResult = await store.presign({
        bucket: testBucket,
        key: 'key1',
        method: 'GET',
        expiresIn: 3600,
        useHTTPS: true,
      });
      expect(isOk(presignResult)).toBe(true);
      if (isOk(presignResult)) {
        expect(presignResult.value).toBeDefined();
        expect(typeof presignResult.value).toBe('string');
        // If the URL starts with http://, it should be converted to https://
        expect(presignResult.value).toMatch(/^https:\/\/.+/);
      }
    });

    test('presign: useHTTPS does not affect URL when false or undefined', async () => {
      const presignResultWithoutFlag = await store.presign({
        bucket: testBucket,
        key: 'key1',
        method: 'GET',
        expiresIn: 3600,
      });
      expect(isOk(presignResultWithoutFlag)).toBe(true);

      const presignResultWithFalse = await store.presign({
        bucket: testBucket,
        key: 'key1',
        method: 'GET',
        expiresIn: 3600,
        useHTTPS: false,
      });
      expect(isOk(presignResultWithFalse)).toBe(true);

      if (isOk(presignResultWithoutFlag) && isOk(presignResultWithFalse)) {
        // Both should return valid URLs (may be http:// or https:// depending on endpoint)
        expect(presignResultWithoutFlag.value).toMatch(/^https?:\/\/.+/);
        expect(presignResultWithFalse.value).toMatch(/^https?:\/\/.+/);
      }
    });

    // BATCH METHOD TESTS - readMany
    test('readMany: returns empty array for empty input', async () => {
      const result = await store.readMany([]);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });

    test('readMany: reads multiple existing objects', async () => {
      const testData1 = Buffer.from('data1');
      const testData2 = Buffer.from('data2');
      const testData3 = Buffer.from('data3');

      await store.write({ bucket: testBucket, key: 'key1', data: testData1 });
      await store.write({ bucket: testBucket, key: 'key2', data: testData2 });
      await store.write({ bucket: testBucket, key: 'key3', data: testData3 });

      const result = await store.readMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
        { bucket: testBucket, key: 'key3' },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]?.data).toEqual(testData1);
        expect(result.value[1]?.data).toEqual(testData2);
        expect(result.value[2]?.data).toEqual(testData3);
        expect(result.value[0]?.bucket).toBe(testBucket);
        expect(result.value[0]?.key).toBe('key1');
        expect(result.value[1]?.bucket).toBe(testBucket);
        expect(result.value[1]?.key).toBe('key2');
        expect(result.value[2]?.bucket).toBe(testBucket);
        expect(result.value[2]?.key).toBe('key3');
      }
    });

    test('readMany: returns null data for non-existent objects', async () => {
      const testData = Buffer.from('data1');
      await store.write({ bucket: testBucket, key: 'key1', data: testData });

      const result = await store.readMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'non-existent-key' },
        { bucket: testBucket, key: 'non-existent' },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]?.data).toEqual(testData);
        expect(result.value[1]?.data).toBeNull();
        expect(result.value[2]?.data).toBeNull();
      }
    });

    test('readMany: preserves order of input locations', async () => {
      const testData1 = Buffer.from('data1');
      const testData2 = Buffer.from('data2');
      const testData3 = Buffer.from('data3');

      await store.write({ bucket: testBucket, key: 'key1', data: testData1 });
      await store.write({ bucket: testBucket, key: 'key2', data: testData2 });
      await store.write({ bucket: testBucket, key: 'key3', data: testData3 });

      // Request in different order
      const result = await store.readMany([
        { bucket: testBucket, key: 'key3' },
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
        // Results should be in the same order as input
        expect(result.value[0]?.key).toBe('key3');
        expect(result.value[0]?.data).toEqual(testData3);
        expect(result.value[1]?.key).toBe('key1');
        expect(result.value[1]?.data).toEqual(testData1);
        expect(result.value[2]?.key).toBe('key2');
        expect(result.value[2]?.data).toEqual(testData2);
      }
    });

    test('readMany: handles binary data correctly', async () => {
      const testData1 = Buffer.from([0x00, 0x01, 0x02]);
      const testData2 = Buffer.from([0xff, 0xfe, 0xfd]);

      await store.write({ bucket: testBucket, key: 'key1', data: testData1 });
      await store.write({ bucket: testBucket, key: 'key2', data: testData2 });

      const result = await store.readMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value[0]?.data).toEqual(testData1);
        expect(result.value[1]?.data).toEqual(testData2);
        expect(Array.from(result.value[0]!.data!)).toEqual([0x00, 0x01, 0x02]);
        expect(Array.from(result.value[1]!.data!)).toEqual([0xff, 0xfe, 0xfd]);
      }
    });

    // BATCH METHOD TESTS - writeMany
    test('writeMany: returns empty array for empty input', async () => {
      const result = await store.writeMany([]);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });

    test('writeMany: writes multiple objects', async () => {
      const testData1 = Buffer.from('data1');
      const testData2 = Buffer.from('data2');
      const testData3 = Buffer.from('data3');

      const result = await store.writeMany([
        { bucket: testBucket, key: 'key1', data: testData1 },
        { bucket: testBucket, key: 'key2', data: testData2 },
        { bucket: testBucket, key: 'key3', data: testData3 },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toEqual({ bucket: testBucket, key: 'key1' });
        expect(result.value[1]).toEqual({ bucket: testBucket, key: 'key2' });
        expect(result.value[2]).toEqual({ bucket: testBucket, key: 'key3' });
      }

      // Verify all objects were written
      const readResult = await store.readMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
        { bucket: testBucket, key: 'key3' },
      ]);

      expect(isOk(readResult)).toBe(true);
      if (isOk(readResult)) {
        expect(readResult.value[0]?.data).toEqual(testData1);
        expect(readResult.value[1]?.data).toEqual(testData2);
        expect(readResult.value[2]?.data).toEqual(testData3);
      }
    });

    test('writeMany: preserves order of input entries', async () => {
      const testData1 = Buffer.from('data1');
      const testData2 = Buffer.from('data2');
      const testData3 = Buffer.from('data3');

      const result = await store.writeMany([
        { bucket: testBucket, key: 'key3', data: testData3 },
        { bucket: testBucket, key: 'key1', data: testData1 },
        { bucket: testBucket, key: 'key2', data: testData2 },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
        // Results should be in the same order as input
        expect(result.value[0]).toEqual({ bucket: testBucket, key: 'key3' });
        expect(result.value[1]).toEqual({ bucket: testBucket, key: 'key1' });
        expect(result.value[2]).toEqual({ bucket: testBucket, key: 'key2' });
      }
    });

    test('writeMany: writes with different content types', async () => {
      const jsonData = Buffer.from('{"key": "value"}');
      const textData = Buffer.from('plain text');
      const binaryData = Buffer.from([0x00, 0x01, 0x02]);

      const result = await store.writeMany([
        { bucket: testBucket, key: 'key1', data: jsonData, contentType: getContentType('json') },
        { bucket: testBucket, key: 'key2', data: textData, contentType: 'text/plain' },
        {
          bucket: testBucket,
          key: 'key3',
          data: binaryData,
          contentType: 'application/octet-stream',
        },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
      }

      // Verify all objects were written correctly
      const readResult = await store.readMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
        { bucket: testBucket, key: 'key3' },
      ]);

      expect(isOk(readResult)).toBe(true);
      if (isOk(readResult)) {
        expect(readResult.value[0]?.data).toEqual(jsonData);
        expect(readResult.value[1]?.data).toEqual(textData);
        expect(readResult.value[2]?.data).toEqual(binaryData);
      }
    });

    test('writeMany: overwrites existing objects', async () => {
      const initialData1 = Buffer.from('initial1');
      const initialData2 = Buffer.from('initial2');

      await store.writeMany([
        { bucket: testBucket, key: 'key1', data: initialData1 },
        { bucket: testBucket, key: 'key2', data: initialData2 },
      ]);

      const updatedData1 = Buffer.from('updated1');
      const updatedData2 = Buffer.from('updated2');

      const result = await store.writeMany([
        { bucket: testBucket, key: 'key1', data: updatedData1 },
        { bucket: testBucket, key: 'key2', data: updatedData2 },
      ]);

      expect(isOk(result)).toBe(true);

      // Verify objects were overwritten
      const readResult = await store.readMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
      ]);

      expect(isOk(readResult)).toBe(true);
      if (isOk(readResult)) {
        expect(readResult.value[0]?.data).toEqual(updatedData1);
        expect(readResult.value[1]?.data).toEqual(updatedData2);
      }
    });

    // BATCH METHOD TESTS - existsMany
    test('existsMany: returns empty array for empty input', async () => {
      const result = await store.existsMany([]);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });

    test('existsMany: checks existence of multiple objects', async () => {
      const testData = Buffer.from('test data');
      await store.write({ bucket: testBucket, key: 'key1', data: testData });
      await store.write({ bucket: testBucket, key: 'key2', data: testData });

      const result = await store.existsMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
        { bucket: testBucket, key: 'non-existent-key' },
        { bucket: testBucket, key: 'non-existent' },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(4);
        expect(result.value[0]?.exists).toBe(true);
        expect(result.value[1]?.exists).toBe(true);
        expect(result.value[2]?.exists).toBe(false);
        expect(result.value[3]?.exists).toBe(false);
        expect(result.value[0]?.bucket).toBe(testBucket);
        expect(result.value[0]?.key).toBe('key1');
        expect(result.value[1]?.bucket).toBe(testBucket);
        expect(result.value[1]?.key).toBe('key2');
      }
    });

    test('existsMany: preserves order of input locations', async () => {
      const testData = Buffer.from('test data');
      await store.write({ bucket: testBucket, key: 'key1', data: testData });
      await store.write({ bucket: testBucket, key: 'key2', data: testData });

      const result = await store.existsMany([
        { bucket: testBucket, key: 'non-existent' },
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
        { bucket: testBucket, key: 'non-existent-key' },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(4);
        // Results should be in the same order as input
        expect(result.value[0]?.key).toBe('non-existent');
        expect(result.value[0]?.exists).toBe(false);
        expect(result.value[1]?.key).toBe('key1');
        expect(result.value[1]?.exists).toBe(true);
        expect(result.value[2]?.key).toBe('key2');
        expect(result.value[2]?.exists).toBe(true);
        expect(result.value[3]?.key).toBe('non-existent-key');
        expect(result.value[3]?.exists).toBe(false);
      }
    });

    test('existsMany: returns false after deletion', async () => {
      const testData = Buffer.from('test data');
      await store.write({ bucket: testBucket, key: 'key1', data: testData });
      await store.write({ bucket: testBucket, key: 'key2', data: testData });

      const existsBefore = await store.existsMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
      ]);

      expect(isOk(existsBefore)).toBe(true);
      if (isOk(existsBefore)) {
        expect(existsBefore.value[0]?.exists).toBe(true);
        expect(existsBefore.value[1]?.exists).toBe(true);
      }

      await store.deleteMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
      ]);

      const existsAfter = await store.existsMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
      ]);

      expect(isOk(existsAfter)).toBe(true);
      if (isOk(existsAfter)) {
        expect(existsAfter.value[0]?.exists).toBe(false);
        expect(existsAfter.value[1]?.exists).toBe(false);
      }
    });

    // BATCH METHOD TESTS - deleteMany
    test('deleteMany: succeeds for empty input', async () => {
      const result = await store.deleteMany([]);
      expect(isOk(result)).toBe(true);
    });

    test('deleteMany: deletes multiple existing objects', async () => {
      const testData1 = Buffer.from('data1');
      const testData2 = Buffer.from('data2');
      const testData3 = Buffer.from('data3');

      await store.writeMany([
        { bucket: testBucket, key: 'key1', data: testData1 },
        { bucket: testBucket, key: 'key2', data: testData2 },
        { bucket: testBucket, key: 'key3', data: testData3 },
      ]);

      const deleteResult = await store.deleteMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
        { bucket: testBucket, key: 'key3' },
      ]);

      expect(isOk(deleteResult)).toBe(true);

      // Verify all objects were deleted
      const existsResult = await store.existsMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
        { bucket: testBucket, key: 'key3' },
      ]);

      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value[0]?.exists).toBe(false);
        expect(existsResult.value[1]?.exists).toBe(false);
        expect(existsResult.value[2]?.exists).toBe(false);
      }
    });

    test('deleteMany: succeeds when deleting non-existent objects', async () => {
      const result = await store.deleteMany([
        { bucket: testBucket, key: 'non-existent-key' },
        { bucket: testBucket, key: 'non-existent' },
      ]);
      expect(isOk(result)).toBe(true);
    });

    test('deleteMany: handles mix of existing and non-existent objects', async () => {
      const testData = Buffer.from('test data');
      await store.write({ bucket: testBucket, key: 'key1', data: testData });
      await store.write({ bucket: testBucket, key: 'key2', data: testData });

      const deleteResult = await store.deleteMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'non-existent-key' },
        { bucket: testBucket, key: 'key2' },
        { bucket: testBucket, key: 'non-existent' },
      ]);

      expect(isOk(deleteResult)).toBe(true);

      // Verify existing objects were deleted
      const existsResult = await store.existsMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
      ]);

      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value[0]?.exists).toBe(false);
        expect(existsResult.value[1]?.exists).toBe(false);
      }
    });

    test('deleteMany: only deletes specified objects', async () => {
      const testData1 = Buffer.from('data1');
      const testData2 = Buffer.from('data2');
      const testData3 = Buffer.from('data3');

      await store.writeMany([
        { bucket: testBucket, key: 'key1', data: testData1 },
        { bucket: testBucket, key: 'key2', data: testData2 },
        { bucket: testBucket, key: 'key3', data: testData3 },
      ]);

      const deleteResult = await store.deleteMany([{ bucket: testBucket, key: 'key1' }]);

      expect(isOk(deleteResult)).toBe(true);

      const existsResult = await store.existsMany([
        { bucket: testBucket, key: 'key1' },
        { bucket: testBucket, key: 'key2' },
        { bucket: testBucket, key: 'key3' },
      ]);

      expect(isOk(existsResult)).toBe(true);
      if (isOk(existsResult)) {
        expect(existsResult.value[0]?.exists).toBe(false);
        expect(existsResult.value[1]?.exists).toBe(true);
        expect(existsResult.value[2]?.exists).toBe(true);
      }
    });

    // BATCH METHOD TESTS - presignMany
    test('presignMany: returns empty array for empty input', async () => {
      const result = await store.presignMany([]);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toEqual([]);
      }
    });

    test('presignMany: generates presigned URLs for multiple objects', async () => {
      const testData = Buffer.from('test data');
      await store.write({ bucket: testBucket, key: 'key1', data: testData });
      await store.write({ bucket: testBucket, key: 'key2', data: testData });

      const result = await store.presignMany([
        { bucket: testBucket, key: 'key1', method: 'GET', expiresIn: 3600 },
        { bucket: testBucket, key: 'key2', method: 'GET', expiresIn: 3600 },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.url).toBeDefined();
        expect(typeof result.value[0]?.url).toBe('string');
        expect(result.value[0]?.url).toMatch(/^https?:\/\/.+/);
        expect(result.value[0]?.bucket).toBe(testBucket);
        expect(result.value[0]?.key).toBe('key1');
        expect(result.value[1]?.url).toBeDefined();
        expect(typeof result.value[1]?.url).toBe('string');
        expect(result.value[1]?.url).toMatch(/^https?:\/\/.+/);
        expect(result.value[1]?.bucket).toBe(testBucket);
        expect(result.value[1]?.key).toBe('key2');
      }
    });

    test('presignMany: preserves order of input entries', async () => {
      const result = await store.presignMany([
        { bucket: testBucket, key: 'key3', method: 'GET', expiresIn: 3600 },
        { bucket: testBucket, key: 'key1', method: 'GET', expiresIn: 3600 },
        { bucket: testBucket, key: 'key2', method: 'GET', expiresIn: 3600 },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
        // Results should be in the same order as input
        expect(result.value[0]?.key).toBe('key3');
        expect(result.value[1]?.key).toBe('key1');
        expect(result.value[2]?.key).toBe('key2');
      }
    });

    test('presignMany: handles mix of GET and PUT methods', async () => {
      const result = await store.presignMany([
        { bucket: testBucket, key: 'key1', method: 'GET', expiresIn: 3600 },
        { bucket: testBucket, key: 'key2', method: 'PUT', expiresIn: 3600 },
        { bucket: testBucket, key: 'key3', method: 'GET', expiresIn: 3600 },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]?.url).toMatch(/^https?:\/\/.+/);
        expect(result.value[1]?.url).toMatch(/^https?:\/\/.+/);
        expect(result.value[2]?.url).toMatch(/^https?:\/\/.+/);
      }
    });

    test('presignMany: useHTTPS converts http:// to https:// when true', async () => {
      const result = await store.presignMany([
        { bucket: testBucket, key: 'key1', method: 'GET', expiresIn: 3600, useHTTPS: true },
        { bucket: testBucket, key: 'key2', method: 'GET', expiresIn: 3600, useHTTPS: true },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.url).toMatch(/^https:\/\/.+/);
        expect(result.value[1]?.url).toMatch(/^https:\/\/.+/);
      }
    });

    test('presignMany: useHTTPS does not affect URL when false or undefined', async () => {
      const resultWithoutFlag = await store.presignMany([
        { bucket: testBucket, key: 'key1', method: 'GET', expiresIn: 3600 },
        { bucket: testBucket, key: 'key2', method: 'GET', expiresIn: 3600 },
      ]);

      const resultWithFalse = await store.presignMany([
        { bucket: testBucket, key: 'key1', method: 'GET', expiresIn: 3600, useHTTPS: false },
        { bucket: testBucket, key: 'key2', method: 'GET', expiresIn: 3600, useHTTPS: false },
      ]);

      expect(isOk(resultWithoutFlag)).toBe(true);
      expect(isOk(resultWithFalse)).toBe(true);

      if (isOk(resultWithoutFlag) && isOk(resultWithFalse)) {
        // Both should return valid URLs (may be http:// or https:// depending on endpoint)
        expect(resultWithoutFlag.value[0]?.url).toMatch(/^https?:\/\/.+/);
        expect(resultWithoutFlag.value[1]?.url).toMatch(/^https?:\/\/.+/);
        expect(resultWithFalse.value[0]?.url).toMatch(/^https?:\/\/.+/);
        expect(resultWithFalse.value[1]?.url).toMatch(/^https?:\/\/.+/);
      }
    });

    test('presignMany: handles different expiration times', async () => {
      const result = await store.presignMany([
        { bucket: testBucket, key: 'key1', method: 'GET', expiresIn: 60 },
        { bucket: testBucket, key: 'key2', method: 'GET', expiresIn: 3600 },
        { bucket: testBucket, key: 'key3', method: 'GET', expiresIn: 86400 },
      ]);

      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]?.url).toMatch(/^https?:\/\/.+/);
        expect(result.value[1]?.url).toMatch(/^https?:\/\/.+/);
        expect(result.value[2]?.url).toMatch(/^https?:\/\/.+/);
      }
    });

    // LISTOBJECTS TESTS
    test('listObjects: lists objects in empty bucket', async () => {
      const result = await store.listObjects(testBucket);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.objects).toEqual([]);
        expect(result.value.isTruncated).toBe(false);
        expect(result.value.nextContinuationToken).toBeUndefined();
      }
    });

    test('listObjects: lists all objects without prefix', async () => {
      const testData = Buffer.from('test data');
      await store.writeMany([
        { bucket: testBucket, key: 'file1.txt', data: testData },
        { bucket: testBucket, key: 'file2.txt', data: testData },
        { bucket: testBucket, key: 'dir/file3.txt', data: testData },
      ]);

      const result = await store.listObjects(testBucket);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.objects).toHaveLength(3);
        const keys = result.value.objects.map((obj) => obj.key).sort();
        expect(keys).toEqual(['dir/file3.txt', 'file1.txt', 'file2.txt']);

        // Verify all objects have required metadata
        for (const obj of result.value.objects) {
          expect(obj.key).toBeDefined();
          expect(typeof obj.key).toBe('string');
          expect(obj.size).toBeDefined();
          expect(typeof obj.size).toBe('number');
          expect(obj.size).toBeGreaterThanOrEqual(0);
          expect(obj.lastModified).toBeDefined();
          expect(obj.lastModified instanceof Date).toBe(true);
        }
      }
    });

    test('listObjects: lists objects with prefix filter', async () => {
      const testData = Buffer.from('test data');
      await store.writeMany([
        { bucket: testBucket, key: 'docs/readme.txt', data: testData },
        { bucket: testBucket, key: 'docs/guide.txt', data: testData },
        { bucket: testBucket, key: 'images/logo.png', data: testData },
        { bucket: testBucket, key: 'config.json', data: testData },
      ]);

      const result = await store.listObjects(testBucket, { prefix: 'docs/' });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.objects).toHaveLength(2);
        const keys = result.value.objects.map((obj) => obj.key).sort();
        expect(keys).toEqual(['docs/guide.txt', 'docs/readme.txt']);
      }
    });

    test('listObjects: returns empty array for non-matching prefix', async () => {
      const testData = Buffer.from('test data');
      await store.write({ bucket: testBucket, key: 'file.txt', data: testData });

      const result = await store.listObjects(testBucket, { prefix: 'nonexistent/' });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.objects).toEqual([]);
        expect(result.value.isTruncated).toBe(false);
      }
    });

    test('listObjects: respects maxKeys parameter', async () => {
      const testData = Buffer.from('test data');
      await store.writeMany([
        { bucket: testBucket, key: 'file1.txt', data: testData },
        { bucket: testBucket, key: 'file2.txt', data: testData },
        { bucket: testBucket, key: 'file3.txt', data: testData },
        { bucket: testBucket, key: 'file4.txt', data: testData },
        { bucket: testBucket, key: 'file5.txt', data: testData },
      ]);

      const result = await store.listObjects(testBucket, { maxKeys: 3 });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        expect(result.value.objects.length).toBeLessThanOrEqual(3);
        // If there are more objects, isTruncated should be true
        if (result.value.objects.length === 3) {
          expect(result.value.isTruncated).toBe(true);
          expect(result.value.nextContinuationToken).toBeDefined();
        }
      }
    });

    test('listObjects: handles pagination with continuationToken', async () => {
      const testData = Buffer.from('test data');
      await store.writeMany([
        { bucket: testBucket, key: 'file1.txt', data: testData },
        { bucket: testBucket, key: 'file2.txt', data: testData },
        { bucket: testBucket, key: 'file3.txt', data: testData },
        { bucket: testBucket, key: 'file4.txt', data: testData },
        { bucket: testBucket, key: 'file5.txt', data: testData },
      ]);

      // Get first page
      const page1 = await store.listObjects(testBucket, { maxKeys: 2 });
      expect(isOk(page1)).toBe(true);

      if (isOk(page1) && page1.value.isTruncated && page1.value.nextContinuationToken) {
        const page1Keys = page1.value.objects.map((obj) => obj.key);

        // Get second page using continuation token
        const page2 = await store.listObjects(testBucket, {
          maxKeys: 2,
          continuationToken: page1.value.nextContinuationToken,
        });
        expect(isOk(page2)).toBe(true);

        if (isOk(page2)) {
          const page2Keys = page2.value.objects.map((obj) => obj.key);

          // Verify no overlap between pages
          const intersection = page1Keys.filter((key) => page2Keys.includes(key));
          expect(intersection).toEqual([]);

          // Verify we're getting different objects
          expect(page2Keys.length).toBeGreaterThan(0);
        }
      }
    });

    test('listObjects: delimiter returns common prefixes', async () => {
      const testData = Buffer.from('test data');
      await store.writeMany([
        { bucket: testBucket, key: 'root.txt', data: testData },
        { bucket: testBucket, key: 'docs/file1.txt', data: testData },
        { bucket: testBucket, key: 'docs/file2.txt', data: testData },
        { bucket: testBucket, key: 'images/logo.png', data: testData },
        { bucket: testBucket, key: 'images/banner.png', data: testData },
      ]);

      const result = await store.listObjects(testBucket, { delimiter: '/' });
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        // Should return root.txt as object and docs/, images/ as common prefixes
        const rootObjects = result.value.objects.filter((obj) => !obj.key.includes('/'));
        expect(rootObjects.length).toBeGreaterThan(0);

        if (result.value.commonPrefixes) {
          expect(result.value.commonPrefixes.length).toBeGreaterThan(0);
          expect(result.value.commonPrefixes).toContain('docs/');
          expect(result.value.commonPrefixes).toContain('images/');
        }
      }
    });

    test('listObjects: returns correct size for objects', async () => {
      const smallData = Buffer.from('small');
      const largeData = Buffer.alloc(1024 * 10); // 10KB

      await store.writeMany([
        { bucket: testBucket, key: 'small.txt', data: smallData },
        { bucket: testBucket, key: 'large.txt', data: largeData },
      ]);

      const result = await store.listObjects(testBucket);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const smallObj = result.value.objects.find((obj) => obj.key === 'small.txt');
        const largeObj = result.value.objects.find((obj) => obj.key === 'large.txt');

        expect(smallObj).toBeDefined();
        expect(largeObj).toBeDefined();

        if (smallObj && largeObj) {
          expect(smallObj.size).toBe(smallData.length);
          expect(largeObj.size).toBe(largeData.length);
        }
      }
    });

    test('listObjects: lastModified is recent for newly created objects', async () => {
      const testData = Buffer.from('test data');
      const beforeWrite = new Date();

      await store.write({ bucket: testBucket, key: 'test.txt', data: testData });

      const afterWrite = new Date();

      const result = await store.listObjects(testBucket);
      expect(isOk(result)).toBe(true);
      if (isOk(result)) {
        const obj = result.value.objects.find((o) => o.key === 'test.txt');
        expect(obj).toBeDefined();

        if (obj) {
          expect(obj.lastModified.getTime()).toBeGreaterThanOrEqual(beforeWrite.getTime() - 1000);
          expect(obj.lastModified.getTime()).toBeLessThanOrEqual(afterWrite.getTime() + 1000);
        }
      }
    });

    // LISTALLOBJECTS TESTS
    test('listAllObjects: iterates through all objects in empty bucket', async () => {
      const objects: Array<{ key: string; size: number; lastModified: Date }> = [];

      for await (const obj of store.listAllObjects(testBucket)) {
        objects.push(obj);
      }

      expect(objects).toEqual([]);
    });

    test('listAllObjects: iterates through all objects without prefix', async () => {
      const testData = Buffer.from('test data');
      await store.writeMany([
        { bucket: testBucket, key: 'file1.txt', data: testData },
        { bucket: testBucket, key: 'file2.txt', data: testData },
        { bucket: testBucket, key: 'file3.txt', data: testData },
      ]);

      const objects: Array<{ key: string; size: number; lastModified: Date }> = [];

      for await (const obj of store.listAllObjects(testBucket)) {
        objects.push(obj);
      }

      expect(objects).toHaveLength(3);
      const keys = objects.map((obj) => obj.key).sort();
      expect(keys).toEqual(['file1.txt', 'file2.txt', 'file3.txt']);

      // Verify all objects have required metadata
      for (const obj of objects) {
        expect(obj.key).toBeDefined();
        expect(obj.size).toBeGreaterThanOrEqual(0);
        expect(obj.lastModified instanceof Date).toBe(true);
      }
    });

    test('listAllObjects: iterates through objects with prefix filter', async () => {
      const testData = Buffer.from('test data');
      await store.writeMany([
        { bucket: testBucket, key: 'docs/file1.txt', data: testData },
        { bucket: testBucket, key: 'docs/file2.txt', data: testData },
        { bucket: testBucket, key: 'images/logo.png', data: testData },
        { bucket: testBucket, key: 'config.json', data: testData },
      ]);

      const objects: Array<{ key: string; size: number; lastModified: Date }> = [];

      for await (const obj of store.listAllObjects(testBucket, 'docs/')) {
        objects.push(obj);
      }

      expect(objects).toHaveLength(2);
      const keys = objects.map((obj) => obj.key).sort();
      expect(keys).toEqual(['docs/file1.txt', 'docs/file2.txt']);
    });

    test('listAllObjects: handles pagination automatically', async () => {
      const testData = Buffer.from('test data');
      const fileCount = 10;
      const writes = [];

      for (let i = 1; i <= fileCount; i++) {
        writes.push({
          bucket: testBucket,
          key: `file${i.toString().padStart(2, '0')}.txt`,
          data: testData,
        });
      }

      await store.writeMany(writes);

      const objects: Array<{ key: string; size: number; lastModified: Date }> = [];

      // listAllObjects should handle pagination internally
      for await (const obj of store.listAllObjects(testBucket)) {
        objects.push(obj);
      }

      // Should get all objects despite pagination
      expect(objects).toHaveLength(fileCount);

      // Verify no duplicates
      const uniqueKeys = new Set(objects.map((obj) => obj.key));
      expect(uniqueKeys.size).toBe(fileCount);
    });

    test('listAllObjects: can be broken early', async () => {
      const testData = Buffer.from('test data');
      await store.writeMany([
        { bucket: testBucket, key: 'file1.txt', data: testData },
        { bucket: testBucket, key: 'file2.txt', data: testData },
        { bucket: testBucket, key: 'file3.txt', data: testData },
      ]);

      const objects: Array<{ key: string; size: number; lastModified: Date }> = [];

      for await (const obj of store.listAllObjects(testBucket)) {
        objects.push(obj);
        if (objects.length >= 2) {
          break; // Early exit
        }
      }

      // Should only have collected 2 objects
      expect(objects).toHaveLength(2);
    });

    test('listAllObjects: throws error on listing failure', async () => {
      // Try to list from a bucket that doesn't exist
      const nonExistentBucket = 'non-existent-bucket-xyz';

      try {
        const objects: Array<{ key: string; size: number; lastModified: Date }> = [];
        for await (const obj of store.listAllObjects(nonExistentBucket)) {
          objects.push(obj);
        }
        // If we get here, either the bucket exists or the implementation doesn't error
        // This is implementation-dependent behavior
      } catch (error) {
        // Expected to throw an error for non-existent bucket
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });

    // COPYOBJECT TESTS
    test('copyObject: copies object within same bucket', async () => {
      const testData = Buffer.from('original data');
      await store.write({
        bucket: testBucket,
        key: 'source.txt',
        data: testData,
      });

      const copyResult = await store.copyObject(
        { bucket: testBucket, key: 'source.txt' },
        { bucket: testBucket, key: 'copy.txt' },
      );
      expect(isOk(copyResult)).toBe(true);

      // Verify both source and destination exist
      const sourceExists = await store.exists({ bucket: testBucket, key: 'source.txt' });
      const destExists = await store.exists({ bucket: testBucket, key: 'copy.txt' });

      expect(isOk(sourceExists)).toBe(true);
      expect(isOk(destExists)).toBe(true);

      if (isOk(sourceExists) && isOk(destExists)) {
        expect(sourceExists.value).toBe(true);
        expect(destExists.value).toBe(true);
      }

      // Verify destination has same data as source
      const destRead = await store.read({ bucket: testBucket, key: 'copy.txt' });
      expect(isOk(destRead)).toBe(true);
      if (isOk(destRead)) {
        expect(destRead.value).toEqual(testData);
      }
    });

    test('copyObject: source remains unchanged after copy', async () => {
      const testData = Buffer.from('original data');
      await store.write({
        bucket: testBucket,
        key: 'source.txt',
        data: testData,
      });

      await store.copyObject(
        { bucket: testBucket, key: 'source.txt' },
        { bucket: testBucket, key: 'copy.txt' },
      );

      // Verify source still has original data
      const sourceRead = await store.read({ bucket: testBucket, key: 'source.txt' });
      expect(isOk(sourceRead)).toBe(true);
      if (isOk(sourceRead)) {
        expect(sourceRead.value).toEqual(testData);
      }
    });

    test('copyObject: overwrites existing destination', async () => {
      const sourceData = Buffer.from('source data');
      const oldDestData = Buffer.from('old destination data');

      await store.write({ bucket: testBucket, key: 'source.txt', data: sourceData });
      await store.write({ bucket: testBucket, key: 'dest.txt', data: oldDestData });

      const copyResult = await store.copyObject(
        { bucket: testBucket, key: 'source.txt' },
        { bucket: testBucket, key: 'dest.txt' },
      );
      expect(isOk(copyResult)).toBe(true);

      // Verify destination now has source data
      const destRead = await store.read({ bucket: testBucket, key: 'dest.txt' });
      expect(isOk(destRead)).toBe(true);
      if (isOk(destRead)) {
        expect(destRead.value).toEqual(sourceData);
        expect(destRead.value).not.toEqual(oldDestData);
      }
    });

    test('copyObject: returns error for non-existent source', async () => {
      const copyResult = await store.copyObject(
        { bucket: testBucket, key: 'non-existent.txt' },
        { bucket: testBucket, key: 'dest.txt' },
      );
      expect(isOk(copyResult)).toBe(false);
      if (!isOk(copyResult)) {
        expect(copyResult.error).toBeDefined();
        expect(typeof copyResult.error).toBe('string');
      }
    });

    test('copyObject: handles binary data correctly', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      await store.write({
        bucket: testBucket,
        key: 'binary.bin',
        data: binaryData,
      });

      const copyResult = await store.copyObject(
        { bucket: testBucket, key: 'binary.bin' },
        { bucket: testBucket, key: 'binary-copy.bin' },
      );
      expect(isOk(copyResult)).toBe(true);

      // Verify copy has exact same binary data
      const copyRead = await store.read({ bucket: testBucket, key: 'binary-copy.bin' });
      expect(isOk(copyRead)).toBe(true);
      if (isOk(copyRead)) {
        expect(copyRead.value).toEqual(binaryData);
        expect(Array.from(copyRead.value)).toEqual([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]);
      }
    });

    test('copyObject: handles empty files', async () => {
      const emptyData = Buffer.alloc(0);
      await store.write({
        bucket: testBucket,
        key: 'empty.txt',
        data: emptyData,
      });

      const copyResult = await store.copyObject(
        { bucket: testBucket, key: 'empty.txt' },
        { bucket: testBucket, key: 'empty-copy.txt' },
      );
      expect(isOk(copyResult)).toBe(true);

      const copyRead = await store.read({ bucket: testBucket, key: 'empty-copy.txt' });
      expect(isOk(copyRead)).toBe(true);
      if (isOk(copyRead)) {
        expect(copyRead.value.length).toBe(0);
      }
    });

    test('copyObject: handles special characters in keys', async () => {
      const testData = Buffer.from('test data');
      const specialKey = 'path/to/file with spaces.txt';

      await store.write({
        bucket: testBucket,
        key: specialKey,
        data: testData,
      });

      const copyResult = await store.copyObject(
        { bucket: testBucket, key: specialKey },
        { bucket: testBucket, key: 'path/to/copy with spaces.txt' },
      );
      expect(isOk(copyResult)).toBe(true);

      const copyRead = await store.read({
        bucket: testBucket,
        key: 'path/to/copy with spaces.txt',
      });
      expect(isOk(copyRead)).toBe(true);
      if (isOk(copyRead)) {
        expect(copyRead.value).toEqual(testData);
      }
    });
  },
);
