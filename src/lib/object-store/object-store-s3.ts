import { S3Client } from 'bun';
import { handleError } from '../error';
import type { Logger } from '../logger';
import { MinioClient } from '../minio/minio-client';
import { Err, Ok, type Result } from '../result';
import { parseAndValidateURL } from '../url';
import { ObjectLocation } from './object-location';
import { ObjectStore } from './object-store';

/**
 * S3 implementation of ObjectStore using Bun's S3Client and MinioClient.
 * Accepts S3 credentials as constructor arguments and initializes clients.
 */
export class S3ObjectStore extends ObjectStore {
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
    super();
    // Use parseAndValidateURL to validate and normalize the s3Endpoint
    const validatedEndpoint = parseAndValidateURL(s3Endpoint, 'Invalid S3 Endpoint');
    this.s3Endpoint = validatedEndpoint;
    // Note: serverBaseUrl is accepted for API compatibility but S3 uses its own presigned URLs
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

  async writeMany(
    entries: Array<ObjectLocation & { data: Buffer; contentType?: string }>,
  ): Promise<Result<ObjectLocation[], string>> {
    if (entries.length === 0) {
      return Ok([]);
    }

    this.logger.debug('Writing multiple objects to S3', { count: entries.length });

    try {
      // Process all writes in parallel, preserving order
      const results = await Promise.all(
        entries.map(async (entry) => {
          const { bucket, key, data, contentType } = entry;
          try {
            await this.s3Client.file(key, { bucket }).write(data, {
              type: contentType ?? '',
            });
            this.logger.debug('Successfully wrote object to S3', { bucket, key, contentType });
            return { bucket, key };
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

  async readStream(params: ObjectLocation): Promise<Result<ReadableStream<Buffer>, string>> {
    this.logger.debug('Reading object stream from S3', {
      bucket: params.bucket,
      key: params.key,
    });

    try {
      const file = this.s3Client.file(params.key, { bucket: params.bucket });
      const doesExist = await file.exists();
      if (!doesExist) {
        this.logger.debug('Object not found in S3', {
          bucket: params.bucket,
          key: params.key,
        });
        return Err(`Object not found: ${ObjectLocation.encode(params)}`);
      }

      // Bun's S3Client file.stream() returns a ReadableStream
      const stream = file.stream();

      // Convert the stream to Buffer chunks
      const bufferStream = new ReadableStream<Buffer>({
        async start(controller) {
          try {
            const reader = stream.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
                break;
              }
              // Convert Uint8Array to Buffer
              const buffer = Buffer.from(value);
              controller.enqueue(buffer);
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            controller.error(new Error(`Failed to read stream: ${errorMessage}`));
          }
        },
      });

      this.logger.debug('Successfully created stream for object from S3', {
        bucket: params.bucket,
        key: params.key,
      });
      return Ok(bufferStream);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to read object stream from S3',
        context: { bucket: params.bucket, key: params.key },
        errorPrefix: 'Failed to read object stream',
      });
    }
  }

  async listObjects(
    bucket: string,
    options?: {
      prefix?: string;
      maxKeys?: number;
      continuationToken?: string;
      delimiter?: string;
    },
  ): Promise<
    Result<
      {
        objects: Array<{
          key: string;
          size: number;
          lastModified: Date;
        }>;
        commonPrefixes?: string[];
        isTruncated: boolean;
        nextContinuationToken?: string;
      },
      string
    >
  > {
    this.logger.debug('Listing objects in S3 bucket', { bucket, options });

    try {
      const prefix = options?.prefix ?? '';
      const maxKeys = options?.maxKeys ?? 1000;
      const delimiter = options?.delimiter;
      const startAfter = options?.continuationToken;

      const objects: Array<{ key: string; size: number; lastModified: Date }> = [];
      const commonPrefixes: string[] = [];
      let isTruncated = false;
      let nextContinuationToken: string | undefined;

      // Use minio client's listObjectsV2 which returns a stream
      // recursive: true when no delimiter (list all recursively), false when delimiter is set (list current level only)
      const recursive = !delimiter;
      const stream = this.minioClient.client.listObjectsV2(bucket, prefix, recursive, startAfter);

      return new Promise((resolve) => {
        let count = 0;
        let lastKey: string | undefined;
        let resolved = false;

        const resolveResult = () => {
          if (resolved) return;
          resolved = true;

          this.logger.debug('Finished listing objects from S3', {
            bucket,
            objectCount: objects.length,
            commonPrefixCount: commonPrefixes.length,
            isTruncated,
          });

          const result: {
            objects: Array<{ key: string; size: number; lastModified: Date }>;
            commonPrefixes?: string[];
            isTruncated: boolean;
            nextContinuationToken?: string;
          } = {
            objects,
            isTruncated,
          };

          if (commonPrefixes.length > 0) {
            result.commonPrefixes = commonPrefixes;
          }

          if (nextContinuationToken) {
            result.nextContinuationToken = nextContinuationToken;
          }

          resolve(Ok(result));
        };

        stream.on('data', (obj) => {
          if (count >= maxKeys) {
            isTruncated = true;
            nextContinuationToken = lastKey;
            stream.destroy();
            resolveResult();
            return;
          }

          if (obj.prefix) {
            // This is a common prefix (directory-like)
            if (delimiter && !commonPrefixes.includes(obj.prefix)) {
              commonPrefixes.push(obj.prefix);
            }
          } else if (obj.name) {
            // This is an object
            objects.push({
              key: obj.name,
              size: obj.size ?? 0,
              lastModified: obj.lastModified ? new Date(obj.lastModified) : new Date(),
            });
            lastKey = obj.name;
            count++;
          }
        });

        stream.on('end', () => {
          resolveResult();
        });

        stream.on('error', (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error);
          this.logger.error('Error listing objects from S3', {
            bucket,
            error: errorMessage,
          });
          resolve(Err(`Failed to list objects: ${errorMessage}`));
        });
      });
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to list objects from S3',
        context: { bucket, options },
        errorPrefix: 'Failed to list objects',
      });
    }
  }

  async copyObject(
    source: ObjectLocation,
    destination: ObjectLocation,
  ): Promise<Result<void, string>> {
    this.logger.debug('Copying object in S3', {
      sourceBucket: source.bucket,
      sourceKey: source.key,
      destBucket: destination.bucket,
      destKey: destination.key,
    });

    try {
      // Check if source exists
      const file = this.s3Client.file(source.key, { bucket: source.bucket });
      const doesExist = await file.exists();
      if (!doesExist) {
        this.logger.debug('Source object not found in S3', {
          bucket: source.bucket,
          key: source.key,
        });
        return Err(`Object not found: ${ObjectLocation.encode(source)}`);
      }

      // Use minio client's copyObject method
      const copySource = `${source.bucket}/${source.key}`;
      await this.minioClient.client.copyObject(destination.bucket, destination.key, copySource);

      this.logger.debug('Successfully copied object in S3', {
        sourceBucket: source.bucket,
        sourceKey: source.key,
        destBucket: destination.bucket,
        destKey: destination.key,
      });
      return Ok(undefined);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to copy object in S3',
        context: {
          sourceBucket: source.bucket,
          sourceKey: source.key,
          destBucket: destination.bucket,
          destKey: destination.key,
        },
        errorPrefix: 'Failed to copy object',
      });
    }
  }
}
