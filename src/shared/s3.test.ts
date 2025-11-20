import { beforeAll, describe, expect, test } from 'bun:test';
import { createLogger } from '../lib/logger';
import { createS3 } from './s3';
import { createMinioClient } from '../lib/minio/minio-client';
import { getS3Config } from './s3-config';

describe('S3 Client', () => {
  const logger = createLogger();
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey } = getS3Config();
  const minioClient = createMinioClient({
    minioEndpoint: s3Endpoint,
    accessKey: s3AccessKeyId,
    secretKey: s3SecretAccessKey,
    logger,
  });
  const testBucket = 'test';
  beforeAll(async () => {
    await minioClient.ensureBucketExists(testBucket);
  });

  test('should support put and get flow', async () => {
    const objectStore = await createS3({ logger });
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
