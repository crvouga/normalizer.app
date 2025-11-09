import { describe, expect, test } from 'bun:test';
import { createLogger } from './lib/logger';
import { createS3 } from './s3';
import { getS3Config } from './s3-config';

describe('S3 Client', () => {
  const logger = createLogger();

  test('should support put and get flow', async () => {
    const { s3Client } = await createS3({ logger });
    const key = `test-key-${Math.random()}`;
    const value = new TextEncoder().encode('Hello S3!');
    const { s3Bucket: bucket } = getS3Config();

    await s3Client.file(key, { bucket }).write(value);

    const downloadResult = await s3Client.file(key, { bucket }).text();
    expect(downloadResult).toBeDefined();
    expect(downloadResult).toBe('Hello S3!');
  });
});
