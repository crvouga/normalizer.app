import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Secret used to sign server-proxied presigned URLs.
 *
 * Used by both:
 * - FilesystemObjectStore (always proxies through the app server)
 * - S3ObjectStore (proxies through the app server when S3_ENDPOINT is loopback,
 *   so a single Fly machine can run the API and MinIO together)
 */
const PRESIGNED_URL_SECRET =
  process.env.OBJECT_STORE_PRESIGNED_URL_SECRET || 'default-secret-key-change-in-production';

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0']);

/**
 * True when the given URL or hostname refers to the local loopback interface.
 * Inputs may be either a hostname like `127.0.0.1` or a full URL like
 * `http://127.0.0.1:9000`.
 */
export function isLoopbackHost(hostnameOrUrl: string): boolean {
  if (!hostnameOrUrl) return false;
  let hostname = hostnameOrUrl;
  try {
    hostname = new URL(hostnameOrUrl).hostname;
  } catch {
    // not a full URL; treat the input as a bare hostname
  }
  return LOOPBACK_HOSTNAMES.has(hostname);
}

function generateSignature(
  bucket: string,
  key: string,
  method: string,
  expiresAt: number,
): string {
  const message = `${method}:${bucket}:${key}:${expiresAt}`;
  return createHmac('sha256', PRESIGNED_URL_SECRET).update(message).digest('hex');
}

/**
 * Build a presigned URL that points at the app server's `/api/objects/...`
 * proxy endpoint. The proxy validates the signature and then reads/writes the
 * underlying ObjectStore.
 */
export function generateServerPresignedUrl(params: {
  serverBaseUrl: string;
  bucket: string;
  key: string;
  method: 'GET' | 'PUT';
  expiresIn: number;
  useHTTPS?: boolean | undefined;
}): string {
  const { serverBaseUrl, bucket, key, method, expiresIn, useHTTPS } = params;

  const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
  const signature = generateSignature(bucket, key, method, expiresAt);

  const trimmedBase = serverBaseUrl.replace(/\/$/, '');
  const baseUrl = useHTTPS ? trimmedBase.replace(/^http:/, 'https:') : trimmedBase;

  const encodedBucket = encodeURIComponent(bucket);
  const encodedKey = encodeURIComponent(key);

  return `${baseUrl}/api/objects/${encodedBucket}/${encodedKey}?expires=${expiresAt}&method=${method}&signature=${signature}`;
}

/**
 * Verify a signature attached to a server-proxied presigned URL.
 * Returns true only when the HMAC matches the expected value (constant-time
 * comparison to avoid timing attacks).
 */
export function verifyServerPresignedSignature(params: {
  bucket: string;
  key: string;
  method: string;
  expiresAt: number;
  signature: string;
}): boolean {
  const { bucket, key, method, expiresAt, signature } = params;

  const expected = generateSignature(bucket, key, method, expiresAt);

  if (expected.length !== signature.length) {
    return false;
  }

  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}
