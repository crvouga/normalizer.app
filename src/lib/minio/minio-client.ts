import * as Minio from 'minio';
import { handleError, handleErrorAsWarn } from '../error';
import type { Logger } from '../logger';
import { Err, Ok, type Result } from '../result';

export class MinioClient {
  private minioClient: Minio.Client;
  private useSSL: boolean;
  private logger: Logger;

  constructor({
    minioEndpoint,
    accessKey,
    secretKey,
    logger,
  }: {
    minioEndpoint: string;
    accessKey: string;
    secretKey: string;
    logger: Logger;
  }) {
    const url = new URL(minioEndpoint);
    const endPoint = url.hostname;
    const port = url.port ? parseInt(url.port) : url.protocol === 'https:' ? 443 : 80;
    this.useSSL = url.protocol === 'https:';
    this.logger = logger.child(MinioClient.name);
    this.minioClient = new Minio.Client({
      endPoint,
      port,
      useSSL: this.useSSL,
      accessKey,
      secretKey,
    });
  }

  async checkBucketExists(bucket: string): Promise<Result<boolean, string>> {
    try {
      const exists = await this.minioClient.bucketExists(bucket);
      this.logger.info(exists ? 'Bucket already exists' : 'Bucket does not exist', { bucket });
      return Ok(exists);
    } catch (error) {
      return handleErrorAsWarn(error, {
        logger: this.logger,
        logMessage: 'Error checking bucket existence',
        context: { bucket },
        defaultMessage: 'Unknown error checking bucket existence',
      });
    }
  }

  async createBucket(bucket: string): Promise<Result<void, string>> {
    this.logger.info('Creating bucket...', { bucket });

    try {
      let exists: boolean;
      try {
        exists = await this.minioClient.bucketExists(bucket);
        this.logger.info(exists ? 'Bucket already exists' : 'Bucket does not exist', { bucket });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorString = String(error);
        const finalErrorMessage = errorMessage || errorString || 'Unknown error';

        if (
          finalErrorMessage.toLowerCase().includes('unable to connect') ||
          finalErrorMessage.toLowerCase().includes('access the url')
        ) {
          return handleError(error, {
            logger: this.logger,
            logMessage: 'Error creating bucket',
            context: { bucket },
            defaultMessage: 'Unknown error',
          });
        }

        const details = { bucket };
        this.logger.warn('Error checking bucket existence', {
          ...details,
          error: finalErrorMessage,
          errorType: typeof error,
          errorConstructor: error?.constructor?.name,
        });
        exists = false;
      }

      if (exists) {
        return Err('Bucket already exists');
      }

      await this.minioClient.makeBucket(bucket, '');
      this.logger.info('Successfully created bucket', { bucket });
      return Ok(undefined);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Error creating bucket',
        context: { bucket },
        defaultMessage: 'Unknown error creating bucket',
      });
    }
  }

  async setBucketPolicy(bucket: string): Promise<Result<void, string>> {
    this.logger.info('Setting bucket policy...', { bucket });

    try {
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

      await this.minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
      this.logger.info('Successfully set bucket policy', { bucket });
      return Ok(undefined);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Error setting bucket policy',
        context: { bucket },
        defaultMessage: 'Unknown error setting bucket policy',
      });
    }
  }

  async ensureBucketExists(bucket: string): Promise<Result<void, string>> {
    this.logger.info('Checking if bucket exists...', { bucket });

    try {
      const existsResult = await this.checkBucketExists(bucket);
      if (existsResult.tag === 'err') {
        this.logger.error('Error ensuring bucket exists', {
          bucket,
          error: existsResult.error,
        });
        this.logger.warn('Continuing without S3 bucket - some features may not work');
        return Err(existsResult.error);
      }
      if (!existsResult.value) {
        const createResult = await this.createBucket(bucket);
        if (createResult.tag === 'err') {
          this.logger.error('Error creating bucket', {
            bucket,
            error: createResult.error,
          });
          this.logger.warn('Continuing without S3 bucket - some features may not work');
          return Err(createResult.error);
        }
        const policyResult = await this.setBucketPolicy(bucket);
        if (policyResult.tag === 'err') {
          this.logger.warn('Failed to set bucket policy on just-created bucket', {
            bucket,
            error: policyResult.error,
          });
          // Do not treat as hard error for bucket creation, still Ok.
        }
        return Ok(undefined);
      } else {
        const policyResult = await this.setBucketPolicy(bucket);
        if (policyResult.tag === 'err') {
          this.logger.warn('Failed to set bucket policy on existing bucket', {
            bucket,
            error: policyResult.error,
          });
          // We still say Ok for ensureBucketExists
        }
        return Ok(undefined);
      }
    } catch (error) {
      const result = handleError(error, {
        logger: this.logger,
        logMessage: 'Error ensuring bucket exists',
        context: { bucket },
        defaultMessage: 'Unknown error ensuring bucket exists',
      });
      this.logger.warn('Continuing without S3 bucket - some features may not work');
      return result;
    }
  }

  async generatePresignedUrl(
    bucket: string,
    objectKey: string,
    expiresIn: number = 86400,
  ): Promise<Result<string, string>> {
    try {
      let url = await this.minioClient.presignedPutObject(bucket, objectKey, expiresIn);

      if (this.useSSL && url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
        this.logger.info('Converted presigned URL from HTTP to HTTPS', {
          bucket,
          objectKey,
        });
      }

      this.logger.info('Generated presigned URL', {
        bucket,
        objectKey,
        expiresIn,
        useSSL: this.useSSL,
      });
      return Ok(url);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Error generating presigned URL',
        context: { bucket, objectKey },
        defaultMessage: 'Unknown error generating presigned URL',
      });
    }
  }

  async deleteObject(bucket: string, objectKey: string): Promise<Result<void, string>> {
    try {
      await this.minioClient.removeObject(bucket, objectKey);
      this.logger.info('Successfully deleted object', {
        bucket,
        objectKey,
      });
      return Ok(undefined);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Error deleting object',
        context: { bucket, objectKey },
        defaultMessage: 'Unknown error deleting object',
      });
    }
  }

  get client() {
    return this.minioClient;
  }
}
