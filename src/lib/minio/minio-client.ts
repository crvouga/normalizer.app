import * as Minio from 'minio';
import type { Logger } from '../logger';

export const createMinioClient = ({
  minioEndpoint,
  accessKey,
  secretKey,
  logger,
}: {
  minioEndpoint: string;
  accessKey: string;
  secretKey: string;
  logger: Logger;
}) => {
  // Parse the endpoint to extract host and port
  const url = new URL(minioEndpoint);
  const endPoint = url.hostname;
  const port = url.port ? parseInt(url.port) : url.protocol === 'https:' ? 443 : 80;
  const useSSL = url.protocol === 'https:';

  // Create MinIO client instance
  const minioClient = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });

  const checkBucketExists = async (bucket: string): Promise<boolean> => {
    try {
      const exists = await minioClient.bucketExists(bucket);
      logger.info(exists ? 'Bucket already exists' : 'Bucket does not exist', {
        bucket,
      });
      return exists;
    } catch (error) {
      logger.warn('Error checking bucket existence', {
        bucket,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  };

  const createBucket = async (bucket: string): Promise<void> => {
    logger.info('Creating bucket...', { bucket });

    try {
      // Check if bucket already exists first
      const exists = await minioClient.bucketExists(bucket);
      if (exists) {
        throw new Error('Bucket already exists');
      }

      // Create bucket with default region (empty string for MinIO)
      await minioClient.makeBucket(bucket, '');
      logger.info('Successfully created bucket', { bucket });
    } catch (error) {
      logger.error('Error creating bucket', {
        bucket,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const setBucketPolicy = async (bucket: string): Promise<void> => {
    logger.info('Setting bucket policy...', { bucket });

    try {
      // Policy that allows public read and write access to the bucket
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadWrite',
            Effect: 'Allow',
            Principal: '*',
            Action: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
            Resource: [`arn:aws:s3:::${bucket}/*`, `arn:aws:s3:::${bucket}`],
          },
        ],
      };

      await minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
      logger.info('Successfully set bucket policy', { bucket });
    } catch (error) {
      logger.error('Error setting bucket policy', {
        bucket,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const ensureBucketExists = async (bucket: string): Promise<void> => {
    logger.info('Checking if bucket exists...', { bucket });

    try {
      const exists = await checkBucketExists(bucket);
      if (!exists) {
        await createBucket(bucket);
        // Set the bucket policy after creating the bucket
        await setBucketPolicy(bucket);
      } else {
        // Even if bucket exists, ensure policy is set
        try {
          await setBucketPolicy(bucket);
        } catch (error) {
          logger.warn('Failed to set bucket policy on existing bucket', {
            bucket,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      logger.error('Error ensuring bucket exists', {
        bucket,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw the error - let the application continue without S3
      logger.warn('Continuing without S3 bucket - some features may not work');
    }
  };

  const generatePresignedUrl = async (
    bucket: string,
    objectKey: string,
    expiresIn: number = 86400, // 24 hours default
  ): Promise<string> => {
    try {
      const url = await minioClient.presignedPutObject(bucket, objectKey, expiresIn);
      logger.info('Generated presigned URL', {
        bucket,
        objectKey,
        expiresIn,
      });
      return url;
    } catch (error) {
      logger.error('Error generating presigned URL', {
        bucket,
        objectKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  const deleteObject = async (bucket: string, objectKey: string): Promise<void> => {
    try {
      await minioClient.removeObject(bucket, objectKey);
      logger.info('Successfully deleted object', {
        bucket,
        objectKey,
      });
    } catch (error) {
      logger.error('Error deleting object', {
        bucket,
        objectKey,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  return {
    checkBucketExists,
    createBucket,
    setBucketPolicy,
    ensureBucketExists,
    generatePresignedUrl,
    deleteObject,
    client: minioClient,
  };
};

export type MinioClient = ReturnType<typeof createMinioClient>;
