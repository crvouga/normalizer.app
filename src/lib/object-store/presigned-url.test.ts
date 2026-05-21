import { describe, expect, test } from 'bun:test';
import {
  generateServerPresignedUrl,
  isLoopbackHost,
  verifyServerPresignedSignature,
} from './presigned-url';

describe('isLoopbackHost', () => {
  test('returns true for loopback hostnames and URLs', () => {
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
    expect(isLoopbackHost('0.0.0.0')).toBe(true);

    expect(isLoopbackHost('http://localhost:9000')).toBe(true);
    expect(isLoopbackHost('http://127.0.0.1:9000')).toBe(true);
    expect(isLoopbackHost('http://[::1]:9000')).toBe(true);
  });

  test('returns false for non-loopback hosts', () => {
    expect(isLoopbackHost('example.com')).toBe(false);
    expect(isLoopbackHost('s3.amazonaws.com')).toBe(false);
    expect(isLoopbackHost('https://normalizer.chrisvouga.dev')).toBe(false);
    expect(isLoopbackHost('minio.internal:9000')).toBe(false);
  });

  test('returns false for empty input', () => {
    expect(isLoopbackHost('')).toBe(false);
  });
});

describe('generateServerPresignedUrl', () => {
  test('builds a /api/objects URL on the given server base', () => {
    const url = generateServerPresignedUrl({
      serverBaseUrl: 'http://localhost:8080',
      bucket: 'main',
      key: 'artifacts/abc/file.csv',
      method: 'PUT',
      expiresIn: 3600,
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe('http://localhost:8080');
    expect(parsed.pathname).toBe(`/api/objects/main/${encodeURIComponent('artifacts/abc/file.csv')}`);
    expect(parsed.searchParams.get('method')).toBe('PUT');
    expect(parsed.searchParams.get('expires')).toMatch(/^\d+$/);
    expect(parsed.searchParams.get('signature')).toMatch(/^[a-f0-9]{64}$/);
  });

  test('strips trailing slash on serverBaseUrl', () => {
    const url = generateServerPresignedUrl({
      serverBaseUrl: 'http://localhost:8080/',
      bucket: 'main',
      key: 'k',
      method: 'GET',
      expiresIn: 60,
    });
    expect(url.startsWith('http://localhost:8080/api/objects/')).toBe(true);
  });

  test('useHTTPS rewrites scheme', () => {
    const url = generateServerPresignedUrl({
      serverBaseUrl: 'http://normalizer.chrisvouga.dev',
      bucket: 'main',
      key: 'k',
      method: 'GET',
      expiresIn: 60,
      useHTTPS: true,
    });
    expect(url.startsWith('https://normalizer.chrisvouga.dev/')).toBe(true);
  });
});

describe('verifyServerPresignedSignature', () => {
  test('accepts a valid signature produced by generate', () => {
    const url = generateServerPresignedUrl({
      serverBaseUrl: 'http://localhost:8080',
      bucket: 'main',
      key: 'artifacts/abc/file.csv',
      method: 'PUT',
      expiresIn: 3600,
    });
    const parsed = new URL(url);
    const expiresAt = parseInt(parsed.searchParams.get('expires')!, 10);
    const signature = parsed.searchParams.get('signature')!;

    expect(
      verifyServerPresignedSignature({
        bucket: 'main',
        key: 'artifacts/abc/file.csv',
        method: 'PUT',
        expiresAt,
        signature,
      }),
    ).toBe(true);
  });

  test('rejects when bucket, key, method, or expiry differ', () => {
    const url = generateServerPresignedUrl({
      serverBaseUrl: 'http://localhost:8080',
      bucket: 'main',
      key: 'k',
      method: 'PUT',
      expiresIn: 60,
    });
    const parsed = new URL(url);
    const expiresAt = parseInt(parsed.searchParams.get('expires')!, 10);
    const signature = parsed.searchParams.get('signature')!;

    const base = { bucket: 'main', key: 'k', method: 'PUT', expiresAt, signature };

    expect(verifyServerPresignedSignature({ ...base, bucket: 'other' })).toBe(false);
    expect(verifyServerPresignedSignature({ ...base, key: 'other' })).toBe(false);
    expect(verifyServerPresignedSignature({ ...base, method: 'GET' })).toBe(false);
    expect(verifyServerPresignedSignature({ ...base, expiresAt: expiresAt + 1 })).toBe(false);
  });

  test('rejects malformed signatures without throwing', () => {
    expect(
      verifyServerPresignedSignature({
        bucket: 'main',
        key: 'k',
        method: 'PUT',
        expiresAt: 1,
        signature: 'not-a-valid-hex-signature',
      }),
    ).toBe(false);

    expect(
      verifyServerPresignedSignature({
        bucket: 'main',
        key: 'k',
        method: 'PUT',
        expiresAt: 1,
        signature: '',
      }),
    ).toBe(false);
  });
});
