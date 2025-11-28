import { createHmac } from 'crypto';
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { handleError } from '../error';
import type { Logger } from '../logger';
import { Ok, type Result } from '../result';
import { ObjectLocation } from './object-location';
import { ObjectStore } from './object-store';

/**
 * Secret key for signing presigned URLs. In production, this should be stored securely.
 * For filesystem implementation, we use a simple secret for URL signing.
 */
const PRESIGNED_URL_SECRET =
  process.env.OBJECT_STORE_PRESIGNED_URL_SECRET || 'default-secret-key-change-in-production';

/**
 * Filesystem implementation of ObjectStore.
 * Stores objects as files on the local filesystem where:
 * - Buckets map to directories
 * - Keys map to file paths within bucket directories
 * - Supports nested keys (e.g., "folder/subfolder/file.txt")
 */
export class FilesystemObjectStore extends ObjectStore {
  private readonly basePath: string;
  private readonly serverBaseUrl: string;
  private readonly logger: Logger;

  constructor({
    basePath,
    serverBaseUrl,
    logger,
  }: {
    basePath: string;
    serverBaseUrl: string;
    logger: Logger;
  }) {
    super();
    this.basePath = resolve(basePath);
    this.serverBaseUrl = serverBaseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.logger = logger.child(FilesystemObjectStore.name);

    // Ensure base directory exists
    if (!existsSync(this.basePath)) {
      mkdirSync(this.basePath, { recursive: true });
      this.logger.debug('Created base directory', { basePath: this.basePath });
    }

    this.logger.debug('Initialized FilesystemObjectStore', {
      basePath: this.basePath,
      serverBaseUrl: this.serverBaseUrl,
    });
  }

  /**
   * Get the filesystem path for a given bucket and key.
   */
  private getObjectPath(bucket: string, key: string): string {
    // Sanitize bucket name to prevent directory traversal
    const sanitizedBucket = bucket.replace(/[^a-zA-Z0-9._-]/g, '_');
    // Join bucket and key, resolving any path issues
    return join(this.basePath, sanitizedBucket, key);
  }

  /**
   * Ensure parent directories exist for a given path.
   */
  private ensureParentDirectory(filePath: string): void {
    const dirPath = join(filePath, '..');
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
    }
  }

  async readMany(
    locations: ObjectLocation[],
  ): Promise<Result<Array<ObjectLocation & { data: Buffer | null }>, string>> {
    if (locations.length === 0) {
      return Ok([]);
    }

    this.logger.debug('Reading multiple objects from filesystem', { count: locations.length });

    try {
      // Process all reads in parallel, preserving order
      const results = await Promise.all(
        locations.map(async (location) => {
          try {
            const filePath = this.getObjectPath(location.bucket, location.key);

            if (!existsSync(filePath)) {
              this.logger.debug('Object not found on filesystem', {
                bucket: location.bucket,
                key: location.key,
                filePath,
              });
              return { ...location, data: null };
            }

            const data = readFileSync(filePath);
            this.logger.debug('Successfully read object from filesystem', {
              bucket: location.bucket,
              key: location.key,
              size: data.length,
            });
            return { ...location, data };
          } catch (error) {
            // If any read fails, return error for the entire batch
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to read ${ObjectLocation.encode(location)}: ${errorMessage}`);
          }
        }),
      );

      this.logger.debug('Successfully read multiple objects from filesystem', {
        count: locations.length,
      });
      return Ok(results);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to read multiple objects from filesystem',
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

    this.logger.debug('Writing multiple objects to filesystem', { count: entries.length });

    try {
      // Process all writes in parallel, preserving order
      const results = await Promise.all(
        entries.map(async (entry) => {
          const { bucket, key, data } = entry;
          try {
            const filePath = this.getObjectPath(bucket, key);

            // Ensure parent directory exists
            this.ensureParentDirectory(filePath);

            writeFileSync(filePath, data);

            this.logger.debug('Successfully wrote object to filesystem', {
              bucket,
              key,
              size: data.length,
              contentType: entry.contentType,
            });
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

      this.logger.debug('Successfully wrote multiple objects to filesystem', {
        count: entries.length,
      });
      return Ok(results);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to write multiple objects to filesystem',
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

    this.logger.debug('Checking existence of multiple objects on filesystem', {
      count: locations.length,
    });

    try {
      // Process all existence checks in parallel, preserving order
      const results = await Promise.all(
        locations.map(async (location) => {
          try {
            const filePath = this.getObjectPath(location.bucket, location.key);
            const exists = existsSync(filePath) && statSync(filePath).isFile();

            this.logger.debug('Checked existence of object on filesystem', {
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

      this.logger.debug('Successfully checked existence of multiple objects on filesystem', {
        count: locations.length,
      });
      return Ok(results);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to check existence of multiple objects on filesystem',
        context: { count: locations.length },
        errorPrefix: 'Failed to check if objects exist',
      });
    }
  }

  async deleteMany(locations: ObjectLocation[]): Promise<Result<void, string>> {
    if (locations.length === 0) {
      return Ok(undefined);
    }

    this.logger.debug('Deleting multiple objects from filesystem', { count: locations.length });

    try {
      // Process all deletes in parallel
      await Promise.all(
        locations.map(async (location) => {
          try {
            const filePath = this.getObjectPath(location.bucket, location.key);

            if (!existsSync(filePath)) {
              this.logger.debug('Object does not exist on filesystem, nothing to delete', {
                bucket: location.bucket,
                key: location.key,
              });
              return;
            }

            unlinkSync(filePath);

            this.logger.debug('Successfully deleted object from filesystem', {
              bucket: location.bucket,
              key: location.key,
            });
          } catch (error) {
            // For delete, we try to verify it's gone even if delete failed
            try {
              const filePath = this.getObjectPath(location.bucket, location.key);
              if (!existsSync(filePath)) {
                // Object is gone, consider deletion successful
                this.logger.debug(
                  'Object not found after failed delete, considering deletion successful',
                  {
                    bucket: location.bucket,
                    key: location.key,
                  },
                );
                return;
              }
              // Still exists, throw error
              const errorMessage = error instanceof Error ? error.message : String(error);
              throw new Error(
                `Failed to delete ${ObjectLocation.encode(location)}: ${errorMessage}`,
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

      this.logger.debug('Successfully deleted multiple objects from filesystem', {
        count: locations.length,
      });
      return Ok(undefined);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to delete multiple objects from filesystem',
        context: { count: locations.length },
        errorPrefix: 'Failed to delete objects',
      });
    }
  }

  async bucketExists(bucket: string): Promise<Result<boolean, string>> {
    this.logger.debug('Checking if bucket exists', { bucket });
    try {
      const bucketPath = join(this.basePath, bucket.replace(/[^a-zA-Z0-9._-]/g, '_'));
      const exists = existsSync(bucketPath) && statSync(bucketPath).isDirectory();
      this.logger.debug('Bucket existence checked', { bucket, exists });
      return Ok(exists);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to check if bucket exists',
        context: { bucket },
        errorPrefix: 'Failed to check if bucket exists',
      });
    }
  }

  async createBucket(bucket: string): Promise<Result<void, string>> {
    this.logger.debug('Creating bucket', { bucket });
    try {
      const bucketPath = join(this.basePath, bucket.replace(/[^a-zA-Z0-9._-]/g, '_'));

      if (existsSync(bucketPath)) {
        this.logger.debug('Bucket already exists, skipping creation', { bucket });
        return Ok(undefined);
      }

      mkdirSync(bucketPath, { recursive: true });
      this.logger.debug('Bucket created successfully', { bucket });
      return Ok(undefined);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to create bucket',
        context: { bucket },
        errorPrefix: 'Failed to create bucket',
      });
    }
  }

  async ensureBucketExists(bucket: string): Promise<Result<void, string>> {
    this.logger.debug('Ensuring bucket exists', { bucket });
    const existsResult = await this.bucketExists(bucket);
    if (existsResult.tag === 'err') {
      return existsResult;
    }
    if (existsResult.tag === 'ok' && existsResult.value) {
      this.logger.debug('Bucket already exists', { bucket });
      return Ok(undefined);
    }
    return this.createBucket(bucket);
  }

  /**
   * Generate a signature for presigned URL validation.
   */
  private generateSignature(
    bucket: string,
    key: string,
    method: string,
    expiresAt: number,
  ): string {
    const message = `${method}:${bucket}:${key}:${expiresAt}`;
    return createHmac('sha256', PRESIGNED_URL_SECRET).update(message).digest('hex');
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
            const expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
            const signature = this.generateSignature(bucket, key, method, expiresAt);

            // Encode bucket and key for URL
            const encodedBucket = encodeURIComponent(bucket);
            const encodedKey = encodeURIComponent(key);

            // Build presigned URL
            const baseUrl = useHTTPS
              ? this.serverBaseUrl.replace(/^http:/, 'https:')
              : this.serverBaseUrl;

            const url = `${baseUrl}/api/objects/${encodedBucket}/${encodedKey}?expires=${expiresAt}&method=${method}&signature=${signature}`;

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
          serverBaseUrl: this.serverBaseUrl,
        },
        defaultMessage: 'Unknown error during presigned URL generation',
        errorPrefix: 'Failed to generate presigned URLs',
      });
    }
  }

  async getEndpointInfo(): Promise<Result<{ baseUrl: string; useHTTPS: boolean }, string>> {
    this.logger.debug('Fetching endpoint info', { serverBaseUrl: this.serverBaseUrl });
    try {
      const url = new URL(this.serverBaseUrl);
      const baseUrl = `${url.protocol}//${url.host}`;
      const useHTTPS = url.protocol === 'https:';

      this.logger.debug('Fetched endpoint info', { baseUrl, useHTTPS });
      return Ok({ baseUrl, useHTTPS });
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to get endpoint info',
        context: { serverBaseUrl: this.serverBaseUrl },
        errorPrefix: 'Failed to get endpoint info',
      });
    }
  }
}
