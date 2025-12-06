import { beforeAll, describe, expect, test } from 'bun:test';
import { createLogger } from '../lib/logger';
import type { ObjectStore } from '../lib/object-store/object-store';
import { S3ObjectStore } from '../lib/object-store/object-store-s3';
import { createObjectStore } from './s3';
import { getS3Config } from './s3-config';

describe('S3 Client', () => {
  const logger = createLogger({ noop: true });
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey } = getS3Config();
  const objectStore: ObjectStore = new S3ObjectStore({
    s3Endpoint,
    s3AccessKeyId,
    s3SecretAccessKey,
    logger,
  });
  const testBucket = 'test';
  beforeAll(async () => {
    await objectStore.ensureBucketExists(testBucket);
  });

  test('should support put and get flow', async () => {
    const objectStore = await createObjectStore({ logger });
    const key = `test-key-${Math.random()}`;
    const value = Buffer.from('Hello S3!');
    const bucket = 'test';

    const writeResult = await objectStore.write({ bucket, key, data: value });
    expect(writeResult.tag).toBe('ok');

    const readResult = await objectStore.read({ bucket, key });
    expect(readResult.tag).toBe('ok');
    if (readResult.tag === 'ok') {
      expect(readResult.value.toString()).toBe('Hello S3!');
    }
  });
});
