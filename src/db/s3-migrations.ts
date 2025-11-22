import { createLogger } from '../lib/logger';
import { getS3Config } from '../shared/s3-config';
import { createObjectStore } from '../shared/s3';
import { isOk } from '../lib/result';

/**
 * Ensures the S3 bucket specified in S3_BUCKET environment variable exists.
 * Creates the bucket if it doesn't exist and sets the appropriate bucket policy.
 */
export const runS3Migrations = async (): Promise<void> => {
  const logger = createLogger();

  logger.info('Starting S3 bucket migration...');

  try {
    const { s3Endpoint, s3Bucket } = getS3Config();
    logger.info('S3 configuration loaded', {
      endpoint: s3Endpoint,
      bucket: s3Bucket,
    });
    logger.info('Creating object store...');
    const objectStore = await createObjectStore({ logger });
    logger.info('Ensuring bucket exists...', { bucket: s3Bucket });
    const result = await objectStore.ensureBucketExists(s3Bucket);
    if (!isOk(result)) {
      throw new Error(`Failed to ensure bucket exists: ${result.error}`);
    }

    logger.info('S3 bucket migration completed successfully', {
      endpoint: s3Endpoint,
      bucket: s3Bucket,
    });
  } catch (error) {
    logger.error('S3 bucket migration failed', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};

// Allow running directly: bun run src/db/s3-migrations.ts
if (import.meta.main) {
  runS3Migrations()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed to run S3 migrations:', error);
      process.exit(1);
    });
}
