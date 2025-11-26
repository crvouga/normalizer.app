import type { Logger } from '../lib/logger';
import type { ObjectStore } from '../lib/object-store/object-store';
import { S3ObjectStore } from '../lib/object-store/object-store-s3';
import { getS3Config } from './s3-config';

export async function createObjectStore({ logger }: { logger: Logger }): Promise<ObjectStore> {
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey, s3Bucket } = getS3Config();

  logger.info('Initializing S3 object store...', { endpoint: s3Endpoint, bucket: s3Bucket });

  try {
    const objectStore = new S3ObjectStore({
      s3Endpoint,
      s3AccessKeyId,
      s3SecretAccessKey,
      logger,
    });
    logger.debug('S3 Endpoint validated', { endpoint: s3Endpoint });
    logger.debug('Ensuring bucket exists', { bucket: s3Bucket });
    const bucketResult = await objectStore.ensureBucketExists(s3Bucket);
    if (bucketResult.tag === 'err') {
      logger.warn('Failed to ensure bucket exists - continuing anyway', {
        error: bucketResult.error,
        endpoint: s3Endpoint,
        bucket: s3Bucket,
      });
      logger.warn('Some S3 features may not work until the bucket is available');
    } else {
      logger.info('Successfully initialized S3 object store', {
        endpoint: s3Endpoint,
        bucket: s3Bucket,
      });
    }
    return objectStore;
  } catch (error) {
    logger.error('Failed to initialize S3 object store', {
      error,
      endpoint: s3Endpoint,
      bucket: s3Bucket,
    });
    throw error instanceof Error ? error : new Error('Failed to initialize S3 object store');
  }
}
