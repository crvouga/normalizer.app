import { S3Client } from 'bun';
import { handleError } from '../error';
import type { Logger } from '../logger';
import { MinioClient } from '../minio/minio-client';
import { Err, Ok, type Result } from '../result';
import { parseAndValidateURL } from '../url';
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
    // Use parseAndValidateURL to validate and normalize the s3Endpoint
    const validatedEndpoint = parseAndValidateURL(s3Endpoint, 'Invalid S3 Endpoint');
    this.s3Endpoint = validatedEndpoint;
    this.logger = logger.child(S3ObjectStore.name);

    this.s3Client = new S3Client({
      endpoint: validatedEndpoint,
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey,
    });

    this.logger.debug('Initialized Bun S3Client', {
      s3Endpoint: validatedEndpoint,
    });

    this.minioClient = new MinioClient({
      minioEndpoint: validatedEndpoint,
      accessKey: s3AccessKeyId,
      secretKey: s3SecretAccessKey,
      logger: this.logger,
    });
  }

  async read(params: { bucket: string; key: string }): Promise<Result<Buffer, string>> {
    const { bucket, key } = params;
    this.logger.debug('Reading object from S3', { bucket, key });
    try {
      const file = this.s3Client.file(key, { bucket });

      if (!(await file.exists())) {
        this.logger.warn('Object not found in S3', { bucket, key });
        return Err(`Object not found: ${bucket}/${key}`);
      }

      const arrayBuffer = await file.arrayBuffer();
      this.logger.debug('Successfully read object from S3', { bucket, key });
      return Ok(Buffer.from(arrayBuffer));
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to read object from S3',
        context: { bucket, key },
        errorPrefix: 'Failed to read object',
      });
    }
  }

  async write(params: {
    bucket: string;
    key: string;
    data: Buffer;
    contentType?: string;
  }): Promise<Result<void, string>> {
    const { bucket, key, data, contentType } = params;
    this.logger.debug('Writing object to S3', { bucket, key, contentType });
    try {
      await this.s3Client.file(key, { bucket }).write(data, {
        type: contentType ?? '',
      });
      this.logger.debug('Successfully wrote object to S3', { bucket, key, contentType });
      return Ok(undefined);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to write object to S3',
        context: { bucket, key, contentType },
        errorPrefix: 'Failed to write object',
      });
    }
  }

  async exists(params: { bucket: string; key: string }): Promise<Result<boolean, string>> {
    const { bucket, key } = params;
    this.logger.debug('Checking existence of object in S3', { bucket, key });
    try {
      const file = this.s3Client.file(key, { bucket });
      const exists = await file.exists();
      this.logger.debug('Checked existence of object in S3', { bucket, key, exists });
      return Ok(exists);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to check if object exists in S3',
        context: { bucket, key },
        errorPrefix: 'Failed to check if object exists',
      });
    }
  }

  async delete(params: { bucket: string; key: string }): Promise<Result<void, string>> {
    const { bucket, key } = params;
    this.logger.debug('Deleting object from S3', { bucket, key });
    try {
      const file = this.s3Client.file(key, { bucket });

      const fileExists = await file.exists();
      if (!fileExists) {
        this.logger.debug('Object does not exist in S3, nothing to delete', { bucket, key });
        return Ok(undefined);
      }

      if (typeof file.delete === 'function') {
        await file.delete();
        this.logger.debug('Deleted object using file.delete', { bucket, key });
      } else {
        await this.s3Client.unlink(key);
        this.logger.debug('Deleted object using S3Client.unlink', { bucket, key });
      }

      this.logger.debug('Successfully deleted object from S3', { bucket, key });
      return Ok(undefined);
    } catch (error) {
      try {
        const file = this.s3Client.file(key, { bucket });
        const stillExists = await file.exists();
        if (stillExists) {
          return handleError(error, {
            logger: this.logger,
            logMessage: 'Failed to delete object from S3, still exists after error',
            context: { bucket, key },
            errorPrefix: 'Failed to delete object',
          });
        }

        this.logger.debug('Object not found after failed delete, considering deletion successful', {
          bucket,
          key,
        });
        return Ok(undefined);
      } catch (innerError) {
        return handleError(error, {
          logger: this.logger,
          logMessage: 'Failed to delete object and re-check existence',
          context: { bucket, key },
          errorPrefix: 'Failed to delete object',
        });
      }
    }
  }

  async bucketExists(bucket: string): Promise<Result<boolean, string>> {
    this.logger.debug('Checking if bucket exists via MinioClient', { bucket });
    const exists = await this.minioClient.checkBucketExists(bucket);
    if (exists.tag === 'ok') {
      this.logger.debug('Bucket existence checked', { bucket, exists: exists.value });
      return Ok(exists.value);
    }
    this.logger.error('Failed to check if bucket exists', { bucket, error: exists.error });
    return Err(`Failed to check if bucket exists: ${exists.error}`);
  }

  async createBucket(bucket: string): Promise<Result<void, string>> {
    this.logger.debug('Creating bucket', { bucket });

    const exists = await this.minioClient.checkBucketExists(bucket);
    if (exists.tag === 'ok' && exists.value) {
      this.logger.debug('Bucket already exists, skipping creation', { bucket });
      return Ok(undefined);
    }

    const createResult = await this.minioClient.createBucket(bucket);
    if (createResult.tag === 'ok') {
      this.logger.debug('Bucket created successfully', { bucket });
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
    this.logger.debug('Ensuring bucket exists', { bucket });
    const result = await this.minioClient.ensureBucketExists(bucket);
    if (result.tag === 'ok') {
      this.logger.debug('Bucket ensured to exist', { bucket });
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
    this.logger.debug('Generating presigned URL', { bucket, key, method, expiresIn, useHTTPS });
    try {
      // Use Bun's S3Client to generate presigned URL
      const file = this.s3Client.file(key, { bucket });

      let url: string;
      if (method === 'GET') {
        url = file.presign({ expiresIn, method: 'GET' });
      } else {
        url = file.presign({ expiresIn, method: 'PUT' });
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

      this.logger.debug('Generated presigned URL', {
        bucket,
        key,
        method,
        expiresIn,
        useHTTPS,
        url,
      });
      return Ok(url);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to generate presigned URL',
        context: {
          bucket,
          key,
          method,
          expiresIn,
          useHTTPS,
          s3Endpoint: this.s3Endpoint,
        },
        defaultMessage: 'Unknown error during presigned URL generation',
        errorPrefix: 'Failed to generate presigned URL',
      });
    }
  }

  async getEndpointInfo(): Promise<Result<{ baseUrl: string; useHTTPS: boolean }, string>> {
    this.logger.debug('Fetching endpoint info', { s3Endpoint: this.s3Endpoint });
    try {
      let baseUrl: string;
      try {
        const url = new URL(this.s3Endpoint);
        baseUrl = `${url.protocol}//${url.host}`;
        this.logger.debug('Parsed endpoint base URL', { baseUrl });
      } catch {
        this.logger.error('Invalid endpoint URL', { s3Endpoint: this.s3Endpoint });
        return Err(`Invalid endpoint URL: ${this.s3Endpoint}`);
      }

      const useHTTPS = this.s3Endpoint.startsWith('https://');
      this.logger.debug('Fetched endpoint info', { baseUrl, useHTTPS });
      return Ok({ baseUrl, useHTTPS });
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to get endpoint info',
        context: { s3Endpoint: this.s3Endpoint },
        errorPrefix: 'Failed to get endpoint info',
      });
    }
  }
}
