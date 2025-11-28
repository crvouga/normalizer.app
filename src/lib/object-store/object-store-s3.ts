import { S3Client } from 'bun';
import { handleError } from '../error';
import type { Logger } from '../logger';
import { MinioClient } from '../minio/minio-client';
import { Err, Ok, isOk, type Result } from '../result';
import { parseAndValidateURL } from '../url';
import { ObjectLocation } from './object-location';
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

  async readMany(
    locations: ObjectLocation[],
  ): Promise<Result<Array<ObjectLocation & { data: Buffer | null }>, string>> {
    if (locations.length === 0) {
      return Ok([]);
    }

    this.logger.debug('Reading multiple objects from S3', { count: locations.length });

    try {
      // Process all reads in parallel, preserving order
      const results = await Promise.all(
        locations.map(async (location) => {
          try {
            const file = this.s3Client.file(location.key, { bucket: location.bucket });
            const doesExist = await file.exists();
            if (!doesExist) {
              this.logger.debug('Object not found in S3', {
                bucket: location.bucket,
                key: location.key,
              });
              return { ...location, data: null };
            }

            const arrayBuffer = await file.arrayBuffer();
            const data = Buffer.from(arrayBuffer);
            this.logger.debug('Successfully read object from S3', {
              bucket: location.bucket,
              key: location.key,
            });
            return { ...location, data };
          } catch (error) {
            // If any read fails, return error for the entire batch
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to read ${ObjectLocation.encode(location)}: ${errorMessage}`);
          }
        }),
      );

      this.logger.debug('Successfully read multiple objects from S3', { count: locations.length });
      return Ok(results);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to read multiple objects from S3',
        context: { count: locations.length },
        errorPrefix: 'Failed to read objects',
      });
    }
  }

  async read(params: ObjectLocation): Promise<Result<Buffer, string>> {
    const result = await this.readMany([params]);
    if (!isOk(result)) {
      return result;
    }
    const item = result.value[0];
    if (!item) {
      return Err(`Object not found: ${ObjectLocation.encode(params)}`);
    }
    if (item.data === null) {
      return Err(`Object not found: ${ObjectLocation.encode(params)}`);
    }
    return Ok(item.data);
  }

  async writeMany(
    entries: Array<ObjectLocation & { data: Buffer; contentType?: string }>,
  ): Promise<Result<ObjectLocation[], string>> {
    if (entries.length === 0) {
      return Ok([]);
    }

    this.logger.debug('Writing multiple objects to S3', { count: entries.length });
    const results: ObjectLocation[] = [];

    try {
      // Process all writes in parallel
      await Promise.all(
        entries.map(async (entry) => {
          const { bucket, key, data, contentType } = entry;
          try {
            await this.s3Client.file(key, { bucket }).write(data, {
              type: contentType ?? '',
            });
            results.push({ bucket, key });
            this.logger.debug('Successfully wrote object to S3', { bucket, key, contentType });
          } catch (error) {
            // If any write fails, return error for the entire batch
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(
              `Failed to write ${ObjectLocation.encode({ bucket, key })}: ${errorMessage}`,
            );
          }
        }),
      );

      this.logger.debug('Successfully wrote multiple objects to S3', { count: entries.length });
      return Ok(results);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to write multiple objects to S3',
        context: { count: entries.length },
        errorPrefix: 'Failed to write objects',
      });
    }
  }

  async write(
    params: ObjectLocation & { data: Buffer; contentType?: string },
  ): Promise<Result<ObjectLocation, string>> {
    const result = await this.writeMany([params]);
    if (!isOk(result)) {
      return result;
    }
    const written = result.value[0];
    if (!written) {
      return Err('Failed to write object: no result returned');
    }
    return Ok(written);
  }

  async existsMany(
    locations: ObjectLocation[],
  ): Promise<Result<Array<ObjectLocation & { exists: boolean }>, string>> {
    if (locations.length === 0) {
      return Ok([]);
    }

    this.logger.debug('Checking existence of multiple objects in S3', { count: locations.length });

    try {
      // Process all existence checks in parallel, preserving order
      const results = await Promise.all(
        locations.map(async (location) => {
          try {
            const file = this.s3Client.file(location.key, { bucket: location.bucket });
            const exists = await file.exists();
            this.logger.debug('Checked existence of object in S3', {
              bucket: location.bucket,
              key: location.key,
              exists,
            });
            return { ...location, exists };
          } catch (error) {
            // If any check fails, return error for the entire batch
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(
              `Failed to check existence of ${ObjectLocation.encode(location)}: ${errorMessage}`,
            );
          }
        }),
      );

      this.logger.debug('Successfully checked existence of multiple objects in S3', {
        count: locations.length,
      });
      return Ok(results);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to check existence of multiple objects in S3',
        context: { count: locations.length },
        errorPrefix: 'Failed to check if objects exist',
      });
    }
  }

  async exists(params: ObjectLocation): Promise<Result<boolean, string>> {
    const result = await this.existsMany([params]);
    if (!isOk(result)) {
      return result;
    }
    const item = result.value[0];
    if (!item) {
      return Ok(false);
    }
    return Ok(item.exists);
  }

  async deleteMany(locations: ObjectLocation[]): Promise<Result<void, string>> {
    if (locations.length === 0) {
      return Ok(undefined);
    }

    this.logger.debug('Deleting multiple objects from S3', { count: locations.length });

    try {
      // Process all deletes in parallel
      await Promise.all(
        locations.map(async (location) => {
          try {
            const file = this.s3Client.file(location.key, { bucket: location.bucket });

            const fileExists = await file.exists();
            if (!fileExists) {
              this.logger.debug('Object does not exist in S3, nothing to delete', {
                bucket: location.bucket,
                key: location.key,
              });
              return;
            }

            if (typeof file.delete === 'function') {
              await file.delete();
              this.logger.debug('Deleted object using file.delete', {
                bucket: location.bucket,
                key: location.key,
              });
            } else {
              await this.s3Client.unlink(location.key);
              this.logger.debug('Deleted object using S3Client.unlink', {
                bucket: location.bucket,
                key: location.key,
              });
            }

            this.logger.debug('Successfully deleted object from S3', {
              bucket: location.bucket,
              key: location.key,
            });
          } catch (error) {
            // For delete, we try to verify it's gone even if delete failed
            try {
              const file = this.s3Client.file(location.key, { bucket: location.bucket });
              const stillExists = await file.exists();
              if (stillExists) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                throw new Error(
                  `Failed to delete ${ObjectLocation.encode(location)}: ${errorMessage}`,
                );
              }
              // Object is gone, consider deletion successful
              this.logger.debug(
                'Object not found after failed delete, considering deletion successful',
                {
                  bucket: location.bucket,
                  key: location.key,
                },
              );
            } catch (innerError) {
              // If verification also fails, throw the original error
              const errorMessage = error instanceof Error ? error.message : String(error);
              throw new Error(
                `Failed to delete ${ObjectLocation.encode(location)}: ${errorMessage}`,
              );
            }
          }
        }),
      );

      this.logger.debug('Successfully deleted multiple objects from S3', {
        count: locations.length,
      });
      return Ok(undefined);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to delete multiple objects from S3',
        context: { count: locations.length },
        errorPrefix: 'Failed to delete objects',
      });
    }
  }

  async delete(params: ObjectLocation): Promise<Result<void, string>> {
    return this.deleteMany([params]);
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

  async presignMany(
    entries: Array<
      ObjectLocation & { method: 'GET' | 'PUT'; expiresIn: number; useHTTPS?: boolean }
    >,
  ): Promise<Result<Array<ObjectLocation & { url: string }>, string>> {
    if (entries.length === 0) {
      return Ok([]);
    }

    this.logger.debug('Generating multiple presigned URLs', { count: entries.length });

    try {
      // Process all presign operations in parallel, preserving order
      const results = await Promise.all(
        entries.map(async (entry) => {
          const { bucket, key, method, expiresIn, useHTTPS } = entry;
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
              throw new Error('Presigned URL generation returned empty or invalid URL');
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
            });
            return { bucket, key, url };
          } catch (error) {
            // If any presign fails, return error for the entire batch
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(
              `Failed to generate presigned URL for ${ObjectLocation.encode({ bucket, key })}: ${errorMessage}`,
            );
          }
        }),
      );

      this.logger.debug('Successfully generated multiple presigned URLs', {
        count: entries.length,
      });
      return Ok(results);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to generate multiple presigned URLs',
        context: {
          count: entries.length,
          s3Endpoint: this.s3Endpoint,
        },
        defaultMessage: 'Unknown error during presigned URL generation',
        errorPrefix: 'Failed to generate presigned URLs',
      });
    }
  }

  async presign(
    params: ObjectLocation & { method: 'GET' | 'PUT'; expiresIn: number; useHTTPS?: boolean },
  ): Promise<Result<string, string>> {
    const result = await this.presignMany([params]);
    if (!isOk(result)) {
      return result;
    }
    const item = result.value[0];
    if (!item) {
      return Err(`Failed to generate presigned URL for ${ObjectLocation.encode(params)}`);
    }
    return Ok(item.url);
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
