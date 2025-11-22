import type { Logger } from '../lib/logger';
import type { ObjectStore } from '../lib/object-store/object-store';
import { S3ObjectStore } from '../lib/object-store/object-store-s3';
import { getS3Config } from './s3-config';

export async function createObjectStore({ logger }: { logger: Logger }): Promise<ObjectStore> {
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey, s3Bucket } = getS3Config();

  logger.info('Initializing S3 object store...', { endpoint: s3Endpoint, bucket: s3Bucket });

  try {
    logger.info('Successfully initialized S3 object store', {
      endpoint: s3Endpoint,
      bucket: s3Bucket,
    });
    const objectStore = new S3ObjectStore({
      s3Endpoint,
      s3AccessKeyId,
      s3SecretAccessKey,
      logger,
    });
    await objectStore.ensureBucketExists(s3Bucket);
    return objectStore;
  } catch (error) {
    logger.error('Failed to initialize S3 object store:', {
      error,
      endpoint: s3Endpoint,
      bucket: s3Bucket,
    });
    throw new Error('Failed to initialize S3 object store');
  }
}
