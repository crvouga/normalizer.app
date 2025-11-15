import type { Logger } from '../lib/logger';
import { S3Client } from 'bun';
import { createMinioClient, type MinioClient } from '../lib/minio/minio-client';
import { getS3Config } from './s3-config';

export const createS3 = async ({
  logger,
}: {
  logger: Logger;
}): Promise<{ s3Client: S3Client; minioClient: MinioClient }> => {
  const { s3Endpoint, s3AccessKeyId, s3SecretAccessKey, s3Bucket } = getS3Config();

  const s3Client = createS3Client({ s3Endpoint, s3AccessKeyId, s3SecretAccessKey, s3Bucket });

  logMinioInit(logger, s3Endpoint, s3Bucket);

  try {
    const minioClient = await initializeMinioClient({
      s3Endpoint,
      s3AccessKeyId,
      s3SecretAccessKey,
      s3Bucket,
      logger,
    });
    logMinioInitSuccess(logger, s3Endpoint, s3Bucket);
    return { s3Client, minioClient };
  } catch (error) {
    logMinioInitError(logger, error, s3Endpoint, s3Bucket);
    throw new Error('Failed to initialize MinIO client');
  }
};

const createS3Client = ({
  s3Endpoint,
  s3AccessKeyId,
  s3SecretAccessKey,
  s3Bucket,
}: {
  s3Endpoint: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3Bucket: string;
}): S3Client =>
  new S3Client({
    endpoint: s3Endpoint,
    accessKeyId: s3AccessKeyId,
    secretAccessKey: s3SecretAccessKey,
    bucket: s3Bucket,
  });

const logMinioInit = (logger: Logger, s3Endpoint: string, s3Bucket: string) => {
  logger.info('Initializing MinIO client...', { endpoint: s3Endpoint, bucket: s3Bucket });
};

const logMinioInitSuccess = (logger: Logger, s3Endpoint: string, s3Bucket: string) => {
  logger.info('Successfully initialized MinIO client', { endpoint: s3Endpoint, bucket: s3Bucket });
};

const logMinioInitError = (
  logger: Logger,
  error: unknown,
  s3Endpoint: string,
  s3Bucket: string,
) => {
  logger.error('Failed to initialize MinIO client:', {
    error,
    endpoint: s3Endpoint,
    bucket: s3Bucket,
  });
};

const ensureMinioBucket = async (
  minioClient: any,
  s3Bucket: string,
  logger: Logger,
  s3Endpoint: string,
) => {
  try {
    await minioClient.ensureBucketExists(s3Bucket);
  } catch (error) {
    logger.warn('Failed to ensure bucket exists, but continuing with MinIO client', {
      error: error instanceof Error ? error.message : String(error),
      endpoint: s3Endpoint,
      bucket: s3Bucket,
    });
  }
};

const initializeMinioClient = async ({
  s3Endpoint,
  s3AccessKeyId,
  s3SecretAccessKey,
  s3Bucket,
  logger,
}: {
  s3Endpoint: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3Bucket: string;
  logger: Logger;
}): Promise<MinioClient> => {
  const minioClient = createMinioClient({
    minioEndpoint: s3Endpoint,
    accessKey: s3AccessKeyId,
    secretKey: s3SecretAccessKey,
    logger,
  });
  await ensureMinioBucket(minioClient, s3Bucket, logger, s3Endpoint);
  return minioClient;
};
