import { describe, test, expect, beforeAll } from 'bun:test';
import { createMinioClient } from './minio-client';
import { createLogger } from '../logger';
import { getS3Config } from '~/src/s3-config';

describe.skip('MinioClient', () => {
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

  test('should check if bucket exists', async () => {
    const exists = await minioClient.checkBucketExists(testBucket);
    expect(exists).toBe(false);
  });

  test('should create a new bucket', async () => {
    await minioClient.createBucket(testBucket);
    const exists = await minioClient.checkBucketExists(testBucket);
    expect(exists).toBe(true);
  });

  test('should ensure bucket exists - create if not exists', async () => {
    const newBucket = 'test';
    await minioClient.ensureBucketExists(newBucket);
    const exists = await minioClient.checkBucketExists(newBucket);
    expect(exists).toBe(true);
  });

  test.skip('should ensure bucket exists - do nothing if exists', async () => {
    await minioClient.ensureBucketExists(testBucket);
    const exists = await minioClient.checkBucketExists(testBucket);
    expect(exists).toBe(true);
  });

  test('should throw error when trying to create bucket that already exists', async () => {
    await expect(minioClient.createBucket(testBucket)).rejects.toThrow();
  });
});
