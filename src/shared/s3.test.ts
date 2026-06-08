import { beforeAll, describe, expect, test } from 'bun:test';
import { createLogger } from '../lib/logger';
import { objectKey } from '../lib/object-store/object-key';
import type { ObjectStore } from '../lib/object-store/object-store';
import { S3ObjectStore } from '../lib/object-store/object-store-s3';
import { isOk } from '../lib/result';
import { createObjectStore } from './s3';
import { getS3Config } from './s3-config';

describe('S3 Client', () => {
  const logger = createLogger({ noop: true });
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey, s3Region } = getS3Config();
  const objectStore: ObjectStore = new S3ObjectStore({
    s3Endpoint,
    s3AccessKeyId,
    s3SecretAccessKey,
    s3Region,
    keyPrefix: 'normalizer-app',
    logger,
  });
  const testBucket = 'test';
  beforeAll(async () => {
    await objectStore.ensureBucketExists(testBucket);
  });

  test('should support put and get flow', async () => {
    const objectStore = await createObjectStore({ logger });
    const key = objectKey('test', `test-key-${Math.random()}`);
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

describe('S3ObjectStore proxy presign', () => {
  const logger = createLogger({ noop: true });
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey, s3Region } = getS3Config();
  const serverBaseUrl = 'http://localhost:8080';

  test('loopback S3_ENDPOINT + serverBaseUrl produces /api/objects URLs on the server origin', async () => {
    const store = new S3ObjectStore({
      s3Endpoint,
      s3AccessKeyId,
      s3SecretAccessKey,
      s3Region,
      keyPrefix: 'normalizer-app',
      serverBaseUrl,
      logger,
    });

    const presign = await store.presign({
      bucket: 'main',
      key: objectKey('artifacts', 'abc', 'file.csv'),
      method: 'PUT',
      expiresIn: 3600,
    });
    expect(isOk(presign)).toBe(true);
    if (!isOk(presign)) return;

    const url = new URL(presign.value);
    expect(url.origin).toBe(serverBaseUrl);
    expect(url.pathname.startsWith('/api/objects/')).toBe(true);
    expect(url.searchParams.get('method')).toBe('PUT');
    expect(url.searchParams.get('signature')).toMatch(/^[a-f0-9]{64}$/);

    const info = await store.getEndpointInfo();
    expect(isOk(info)).toBe(true);
    if (isOk(info)) {
      expect(info.value.baseUrl).toBe(serverBaseUrl);
      expect(info.value.useHTTPS).toBe(false);
    }
  });

  test('non-loopback endpoint keeps direct S3 presign behavior', async () => {
    const store = new S3ObjectStore({
      s3Endpoint: 'https://s3.example.com',
      s3AccessKeyId,
      s3SecretAccessKey,
      s3Region: 'us-west-004',
      keyPrefix: 'normalizer-app',
      serverBaseUrl,
      logger,
    });

    const info = await store.getEndpointInfo();
    expect(isOk(info)).toBe(true);
    if (isOk(info)) {
      expect(info.value.baseUrl).toBe('https://s3.example.com');
      expect(info.value.useHTTPS).toBe(true);
    }

    const presign = await store.presign({
      bucket: 'main',
      key: objectKey('test', 'file.csv'),
      method: 'GET',
      expiresIn: 60,
    });
    if (isOk(presign)) {
      expect(new URL(presign.value).origin).not.toBe(serverBaseUrl);
    }
  });

  test('loopback endpoint without serverBaseUrl keeps direct S3 presign behavior', async () => {
    const store = new S3ObjectStore({
      s3Endpoint,
      s3AccessKeyId,
      s3SecretAccessKey,
      s3Region,
      keyPrefix: 'normalizer-app',
      logger,
    });

    const presign = await store.presign({
      bucket: 'main',
      key: objectKey('test', 'file.csv'),
      method: 'GET',
      expiresIn: 60,
    });
    if (isOk(presign)) {
      expect(new URL(presign.value).origin).not.toBe(serverBaseUrl);
    }
  });
});
