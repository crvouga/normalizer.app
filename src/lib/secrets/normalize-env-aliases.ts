/**
 * Maps alternate secret-store field names onto the env vars the app expects.
 * Safe to call after vault run injection or KV HTTP load.
 */
export function normalizeEnvAliases(): void {
  if (!process.env.S3_ENDPOINT && process.env.B2_S3_ENDPOINT) {
    process.env.S3_ENDPOINT = process.env.B2_S3_ENDPOINT;
  }
  if (!process.env.S3_ACCESS_KEY && process.env.B2_S3_ACCESS_KEY_ID) {
    process.env.S3_ACCESS_KEY = process.env.B2_S3_ACCESS_KEY_ID;
  }
  if (!process.env.S3_SECRET_KEY && process.env.B2_S3_SECRET_ACCESS_KEY) {
    process.env.S3_SECRET_KEY = process.env.B2_S3_SECRET_ACCESS_KEY;
  }
  if (!process.env.S3_REGION && process.env.B2_S3_REGION) {
    process.env.S3_REGION = process.env.B2_S3_REGION;
  }
  if (!process.env.S3_BUCKET && process.env.B2_BUCKET) {
    process.env.S3_BUCKET = process.env.B2_BUCKET;
  }
  if (!process.env.GOOGLE_CLIENT_ID && process.env.NORMALIZER_APP_GOOGLE_CLIENT_ID) {
    process.env.GOOGLE_CLIENT_ID = process.env.NORMALIZER_APP_GOOGLE_CLIENT_ID;
  }
  if (!process.env.GOOGLE_CLIENT_SECRET && process.env.NORMALIZER_APP_GOOGLE_CLIENT_SECRET) {
    process.env.GOOGLE_CLIENT_SECRET = process.env.NORMALIZER_APP_GOOGLE_CLIENT_SECRET;
  }
}
