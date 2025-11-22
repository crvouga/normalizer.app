import { describe, test, expect, beforeAll } from 'bun:test';
import { MinioClient } from './minio-client';
import { createLogger } from '../logger';
import { getS3Config } from '../../shared/s3-config';

describe('MinioClient', () => {
  const logger = createLogger();
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey } = getS3Config();
  const minioClient = new MinioClient({
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
    expect(exists.tag).toBe('ok');
    if (exists.tag === 'ok') {
      expect(exists.value).toBe(true);
    }
  });

  test('should create a new bucket', async () => {
    const checkResult = await minioClient.checkBucketExists(testBucket);
    if (checkResult.tag === 'ok' && !checkResult.value) {
      await minioClient.createBucket(testBucket);
    }
    const exists = await minioClient.checkBucketExists(testBucket);
    expect(exists.tag).toBe('ok');
    if (exists.tag === 'ok') {
      expect(exists.value).toBe(true);
    }
  });

  test('should ensure bucket exists - create if not exists', async () => {
    const newBucket = 'test';
    await minioClient.ensureBucketExists(newBucket);
    const exists = await minioClient.checkBucketExists(newBucket);
    expect(exists.tag).toBe('ok');
    if (exists.tag === 'ok') {
      expect(exists.value).toBe(true);
    }
  });

  test('should ensure bucket exists - do nothing if exists', async () => {
    await minioClient.ensureBucketExists(testBucket);
    const exists = await minioClient.checkBucketExists(testBucket);
    expect(exists.tag).toBe('ok');
    if (exists.tag === 'ok') {
      expect(exists.value).toBe(true);
    }
  });

  test('should return error when trying to create bucket that already exists', async () => {
    const result = await minioClient.createBucket(testBucket);
    expect(result.tag).toBe('err');
    if (result.tag === 'err') {
      expect(result.error).toBe('Bucket already exists');
    }
  });
});
