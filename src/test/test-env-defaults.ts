export const DEFAULT_TEST_S3_ENV = {
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY: 'minioadmin',
  S3_SECRET_KEY: 'minioadmin',
  S3_BUCKET: 'test-bucket',
  S3_REGION: 'us-east-1',
  S3_USE_SSL: 'false',
} as const;

const S3_AND_B2_ENV_KEYS = [
  'S3_ENDPOINT',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_BUCKET',
  'S3_REGION',
  'S3_USE_SSL',
  'B2_S3_ENDPOINT',
  'B2_S3_ACCESS_KEY_ID',
  'B2_S3_SECRET_ACCESS_KEY',
  'B2_S3_REGION',
  'B2_BUCKET',
] as const;

/**
 * Removes shell/vault S3 and B2 aliases so tests never hit remote object storage.
 */
export function scrubUnsafeS3Env(): void {
  for (const key of S3_AND_B2_ENV_KEYS) {
    delete process.env[key];
  }
}

/**
 * Forces local MinIO-compatible defaults for every test run.
 */
export function applyDefaultTestEnv(): void {
  scrubUnsafeS3Env();
  for (const [key, value] of Object.entries(DEFAULT_TEST_S3_ENV)) {
    process.env[key] = value;
  }
}
