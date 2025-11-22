import { S3Client } from 'bun';
import type { Logger } from '../logger';
import { MinioClient } from '../minio/minio-client';
import { Err, Ok, type Result } from '../result';
import type { ObjectStore } from './object-store';

/**
 * S3 implementation of ObjectStore using Bun's S3Client and MinioClient.
 * Accepts S3 credentials as constructor arguments and initializes clients.
 */
export class S3ObjectStore implements ObjectStore {
  private readonly s3Client: S3Client;
  private readonly minioClient: MinioClient;
  private readonly s3Endpoint: string;
  private readonly logger: Logger;

  constructor({
    s3Endpoint,
    s3AccessKeyId,
    s3SecretAccessKey,
    logger,
  }: {
    s3Endpoint: string;
    s3AccessKeyId: string;
    s3SecretAccessKey: string;
    logger: Logger;
  }) {
    this.s3Endpoint = s3Endpoint;
    this.logger = logger;

    this.s3Client = new S3Client({
      endpoint: s3Endpoint,
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey,
    });

    this.logger.info('Initialized Bun S3Client', {
      s3Endpoint,
    });

    this.minioClient = new MinioClient({
      minioEndpoint: s3Endpoint,
      accessKey: s3AccessKeyId,
      secretKey: s3SecretAccessKey,
      logger: this.logger,
    });
  }

  async read(params: { bucket: string; key: string }): Promise<Result<Buffer, string>> {
    const { bucket, key } = params;
    this.logger.info('Reading object from S3', { bucket, key });
    try {
      const file = this.s3Client.file(key, { bucket });

      if (!(await file.exists())) {
        this.logger.warn('Object not found in S3', { bucket, key });
        return Err(`Object not found: ${bucket}/${key}`);
      }

      const arrayBuffer = await file.arrayBuffer();
      this.logger.info('Successfully read object from S3', { bucket, key });
      return Ok(Buffer.from(arrayBuffer));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to read object from S3', { bucket, key, error: errorMessage });
      return Err(`Failed to read object: ${errorMessage}`);
    }
  }

  async write(params: {
    bucket: string;
    key: string;
    data: Buffer;
    contentType?: string;
  }): Promise<Result<void, string>> {
    const { bucket, key, data, contentType } = params;
    this.logger.info('Writing object to S3', { bucket, key, contentType });
    try {
      await this.s3Client.file(key, { bucket }).write(data, {
        type: contentType ?? '',
      });
      this.logger.info('Successfully wrote object to S3', { bucket, key, contentType });
      return Ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to write object to S3', {
        bucket,
        key,
        error: errorMessage,
        contentType,
      });
      return Err(`Failed to write object: ${errorMessage}`);
    }
  }

  async exists(params: { bucket: string; key: string }): Promise<Result<boolean, string>> {
    const { bucket, key } = params;
    this.logger.info('Checking existence of object in S3', { bucket, key });
    try {
      const file = this.s3Client.file(key, { bucket });
      const exists = await file.exists();
      this.logger.info('Checked existence of object in S3', { bucket, key, exists });
      return Ok(exists);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to check if object exists in S3', {
        bucket,
        key,
        error: errorMessage,
      });
      return Err(`Failed to check if object exists: ${errorMessage}`);
    }
  }

  async delete(params: { bucket: string; key: string }): Promise<Result<void, string>> {
    const { bucket, key } = params;
    this.logger.info('Deleting object from S3', { bucket, key });
    try {
      const file = this.s3Client.file(key, { bucket });

      const fileExists = await file.exists();
      if (!fileExists) {
        this.logger.info('Object does not exist in S3, nothing to delete', { bucket, key });
        return Ok(undefined);
      }

      if (typeof file.delete === 'function') {
        await file.delete();
        this.logger.info('Deleted object using file.delete', { bucket, key });
      } else {
        await this.s3Client.unlink(key);
        this.logger.info('Deleted object using S3Client.unlink', { bucket, key });
      }

      this.logger.info('Successfully deleted object from S3', { bucket, key });
      return Ok(undefined);
    } catch (error) {
      try {
        const file = this.s3Client.file(key, { bucket });
        const stillExists = await file.exists();
        if (stillExists) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error('Failed to delete object from S3, still exists after error', {
            bucket,
            key,
            error: errorMessage,
          });
          return Err(`Failed to delete object: ${errorMessage}`);
        }

        this.logger.info('Object not found after failed delete, considering deletion successful', {
          bucket,
          key,
        });
        return Ok(undefined);
      } catch (innerError) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('Failed to delete object and re-check existence', {
          bucket,
          key,
          error: errorMessage,
        });
        return Err(`Failed to delete object: ${errorMessage}`);
      }
    }
  }

  async bucketExists(bucket: string): Promise<Result<boolean, string>> {
    this.logger.info('Checking if bucket exists via MinioClient', { bucket });
    const exists = await this.minioClient.checkBucketExists(bucket);
    if (exists.tag === 'ok') {
      this.logger.info('Bucket existence checked', { bucket, exists: exists.value });
      return Ok(exists.value);
    }
    this.logger.error('Failed to check if bucket exists', { bucket, error: exists.error });
    return Err(`Failed to check if bucket exists: ${exists.error}`);
  }

  async createBucket(bucket: string): Promise<Result<void, string>> {
    this.logger.info('Creating bucket', { bucket });

    const exists = await this.minioClient.checkBucketExists(bucket);
    if (exists.tag === 'ok' && exists.value) {
      this.logger.info('Bucket already exists, skipping creation', { bucket });
      return Ok(undefined);
    }

    const createResult = await this.minioClient.createBucket(bucket);
    if (createResult.tag === 'ok') {
      this.logger.info('Bucket created successfully', { bucket });
      return Ok(undefined);
    }

    if (createResult.error.includes('already exists')) {
      this.logger.warn('Bucket already exists (error from Minio)', { bucket });
      return Ok(undefined);
    }
    this.logger.error('Failed to create bucket', { bucket, error: createResult.error });
    return Err(`Failed to create bucket: ${createResult.error}`);
  }

  async ensureBucketExists(bucket: string): Promise<Result<void, string>> {
    this.logger.info('Ensuring bucket exists', { bucket });
    const result = await this.minioClient.ensureBucketExists(bucket);
    if (result.tag === 'ok') {
      this.logger.info('Bucket ensured to exist', { bucket });
      return Ok(undefined);
    }
    this.logger.error('Failed to ensure bucket exists', { bucket, error: result.error });
    return Err(`Failed to ensure bucket exists: ${result.error}`);
  }

  async presign(params: {
    bucket: string;
    key: string;
    method: 'GET' | 'PUT';
    expiresIn: number;
    useHTTPS?: boolean;
  }): Promise<Result<string, string>> {
    const { bucket, key, method, expiresIn, useHTTPS } = params;
    this.logger.info('Generating presigned URL', { bucket, key, method, expiresIn, useHTTPS });
    try {
      // Verify bucket exists before attempting to presign
      const bucketExistsResult = await this.bucketExists(bucket);
      if (bucketExistsResult.tag === 'err') {
        this.logger.error('Cannot generate presigned URL: bucket check failed', {
          bucket,
          key,
          method,
          error: bucketExistsResult.error,
        });
        return Err(`Bucket check failed: ${bucketExistsResult.error}`);
      }
      if (!bucketExistsResult.value) {
        this.logger.error('Cannot generate presigned URL: bucket does not exist', {
          bucket,
          key,
          method,
        });
        return Err(`Bucket does not exist: ${bucket}`);
      }

      const minioClient = this.minioClient.client;

      let url: string;
      if (method === 'GET') {
        url = await minioClient.presignedGetObject(bucket, key, expiresIn);
      } else {
        url = await minioClient.presignedPutObject(bucket, key, expiresIn);
      }

      // Validate the generated URL
      if (!url || typeof url !== 'string' || url.trim() === '') {
        this.logger.error('Presigned URL generation returned empty or invalid URL', {
          bucket,
          key,
          method,
          url,
        });
        return Err('Presigned URL generation returned empty or invalid URL');
      }

      // Ensure HTTPS if requested
      if (useHTTPS && url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
      }

      this.logger.info('Generated presigned URL', {
        bucket,
        key,
        method,
        expiresIn,
        useHTTPS,
        url,
      });
      return Ok(url);
    } catch (error) {
      // Enhanced error logging to capture full error details
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : undefined;
      const errorString = error ? String(error) : 'Unknown error';
      const errorJson = error ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : 'null';

      this.logger.error('Failed to generate presigned URL', {
        bucket,
        key,
        method,
        expiresIn,
        useHTTPS,
        error: errorMessage || errorString,
        errorName,
        errorStack,
        errorType: typeof error,
        errorConstructor: error?.constructor?.name,
        errorJson,
        s3Endpoint: this.s3Endpoint,
      });

      // Provide a more descriptive error message
      const descriptiveError =
        errorMessage || errorString || 'Unknown error during presigned URL generation';
      return Err(`Failed to generate presigned URL: ${descriptiveError}`);
    }
  }

  async getEndpointInfo(): Promise<Result<{ baseUrl: string; useHTTPS: boolean }, string>> {
    this.logger.info('Fetching endpoint info', { s3Endpoint: this.s3Endpoint });
    try {
      let baseUrl: string;
      try {
        const url = new URL(this.s3Endpoint);
        baseUrl = `${url.protocol}//${url.host}`;
        this.logger.info('Parsed endpoint base URL', { baseUrl });
      } catch {
        this.logger.error('Invalid endpoint URL', { s3Endpoint: this.s3Endpoint });
        return Err(`Invalid endpoint URL: ${this.s3Endpoint}`);
      }

      const useHTTPS = this.s3Endpoint.startsWith('https://');
      this.logger.info('Fetched endpoint info', { baseUrl, useHTTPS });
      return Ok({ baseUrl, useHTTPS });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to get endpoint info', {
        s3Endpoint: this.s3Endpoint,
        error: errorMessage,
      });
      return Err(`Failed to get endpoint info: ${errorMessage}`);
    }
  }
}
