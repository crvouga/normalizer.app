import { createLogger } from '../lib/logger';
import { createMinioClient } from '../lib/minio/minio-client';
import { getS3Config } from '../shared/s3-config';

/**
 * Ensures the S3 bucket specified in S3_BUCKET environment variable exists.
 * Creates the bucket if it doesn't exist and sets the appropriate bucket policy.
 */
export const runS3Migrations = async (): Promise<void> => {
  const logger = createLogger();

  logger.info('Starting S3 bucket migration...');

  try {
    const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey, s3Bucket } = getS3Config();

    logger.info('S3 configuration loaded', {
      endpoint: s3Endpoint,
      bucket: s3Bucket,
    });

    logger.info('Creating MinIO client...');
    const minioClient = createMinioClient({
      minioEndpoint: s3Endpoint,
      accessKey: s3AccessKeyId,
      secretKey: s3SecretAccessKey,
      logger,
    });

    logger.info('Ensuring bucket exists...', { bucket: s3Bucket });
    await minioClient.ensureBucketExists(s3Bucket);

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
