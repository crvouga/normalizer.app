import { beforeAll, describe, expect, test } from 'bun:test';
import { createLogger } from './lib/logger';
import { createS3 } from './s3';
import { createMinioClient } from './lib/minio/minio-client';
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
    const { s3Client } = await createS3({ logger });
    const key = `test-key-${Math.random()}`;
    const value = new TextEncoder().encode('Hello S3!');
    const bucket = 'test';

    await s3Client.file(key, { bucket }).write(value);

    const downloadResult = await s3Client.file(key, { bucket }).text();
    expect(downloadResult).toBeDefined();
    expect(downloadResult).toBe('Hello S3!');
  });
});
