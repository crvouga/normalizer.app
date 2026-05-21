import {
  createReadStream,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { join, resolve } from 'path';
import { handleError } from '../error';
import type { Logger } from '../logger';
import { Err, Ok, type Result } from '../result';
import { ObjectLocation } from './object-location';
import { ObjectStore } from './object-store';
import { generateServerPresignedUrl } from './presigned-url';

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
            const url = generateServerPresignedUrl({
              serverBaseUrl: this.serverBaseUrl,
              bucket,
              key,
              method,
              expiresIn,
              useHTTPS,
            });

            this.logger.debug('Generated presigned URL', {
              bucket,
              key,
              method,
              expiresIn,
              useHTTPS,
            });
            return { bucket, key, url };
          } catch (error) {
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

  async readStream(params: ObjectLocation): Promise<Result<ReadableStream<Buffer>, string>> {
    this.logger.debug('Reading object stream from filesystem', {
      bucket: params.bucket,
      key: params.key,
    });

    try {
      const filePath = this.getObjectPath(params.bucket, params.key);

      if (!existsSync(filePath)) {
        this.logger.debug('Object not found on filesystem', {
          bucket: params.bucket,
          key: params.key,
          filePath,
        });
        return Err(`Object not found: ${ObjectLocation.encode(params)}`);
      }

      // Create a Node.js ReadStream and convert it to Web ReadableStream
      const nodeStream = createReadStream(filePath);

      const webStream = new ReadableStream<Buffer>({
        start(controller) {
          nodeStream.on('data', (chunk: Buffer | string) => {
            // Ensure chunk is a Buffer
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            controller.enqueue(buffer);
          });

          nodeStream.on('end', () => {
            controller.close();
          });

          nodeStream.on('error', (error) => {
            const errorMessage = error instanceof Error ? error.message : String(error);
            controller.error(new Error(`Failed to read stream: ${errorMessage}`));
          });
        },
        cancel() {
          nodeStream.destroy();
        },
      });

      this.logger.debug('Successfully created stream for object from filesystem', {
        bucket: params.bucket,
        key: params.key,
      });
      return Ok(webStream);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to read object stream from filesystem',
        context: { bucket: params.bucket, key: params.key },
        errorPrefix: 'Failed to read object stream',
      });
    }
  }

  /**
   * Recursively walk directory tree and collect all files.
   */
  private walkDirectory(
    dirPath: string,
    prefix: string,
    delimiter?: string,
  ): Array<{ key: string; size: number; lastModified: Date; isPrefix: boolean }> {
    const results: Array<{ key: string; size: number; lastModified: Date; isPrefix: boolean }> = [];

    try {
      const entries = readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dirPath, entry.name);
        // Ensure prefix ends with / for proper key construction
        const normalizedPrefix = prefix && !prefix.endsWith('/') ? `${prefix}/` : prefix;
        const relativeKey = normalizedPrefix ? `${normalizedPrefix}${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          if (delimiter) {
            // With delimiter, treat directories as common prefixes
            results.push({
              key: `${relativeKey}${delimiter}`,
              size: 0,
              lastModified: new Date(),
              isPrefix: true,
            });
          } else {
            // Without delimiter, recursively walk subdirectories
            const subResults = this.walkDirectory(fullPath, `${relativeKey}/`, delimiter);
            results.push(...subResults);
          }
        } else if (entry.isFile()) {
          const stats = statSync(fullPath);
          results.push({
            key: relativeKey,
            size: stats.size,
            lastModified: stats.mtime,
            isPrefix: false,
          });
        }
      }
    } catch (error) {
      // Ignore permission errors or missing directories
      this.logger.debug('Error walking directory', { dirPath, error });
    }

    return results;
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
    this.logger.debug('Listing objects in filesystem bucket', { bucket, options });

    try {
      const sanitizedBucket = bucket.replace(/[^a-zA-Z0-9._-]/g, '_');
      const bucketPath = join(this.basePath, sanitizedBucket);

      if (!existsSync(bucketPath) || !statSync(bucketPath).isDirectory()) {
        this.logger.debug('Bucket does not exist', { bucket });
        return Ok({
          objects: [],
          isTruncated: false,
        });
      }

      const prefix = options?.prefix ?? '';
      const delimiter = options?.delimiter;
      const maxKeys = options?.maxKeys ?? 1000;
      const continuationToken = options?.continuationToken;

      // Get the directory path for the prefix
      const prefixPath = prefix ? join(bucketPath, prefix) : bucketPath;

      // If prefix path doesn't exist, return empty results
      if (prefix && (!existsSync(prefixPath) || !statSync(prefixPath).isDirectory())) {
        return Ok({
          objects: [],
          isTruncated: false,
        });
      }

      // Walk directory tree - pass prefix so keys are relative to bucket root
      const allItems = this.walkDirectory(prefixPath, prefix, delimiter);

      // Filter by prefix if provided (keys should already start with prefix from walkDirectory)
      const filteredItems = allItems;

      // Separate objects and prefixes
      const objects: Array<{ key: string; size: number; lastModified: Date }> = [];
      const commonPrefixesSet = new Set<string>();

      for (const item of filteredItems) {
        if (item.isPrefix) {
          commonPrefixesSet.add(item.key);
        } else {
          objects.push({
            key: item.key,
            size: item.size,
            lastModified: item.lastModified,
          });
        }
      }

      // Sort objects by key for consistent pagination
      objects.sort((a, b) => a.key.localeCompare(b.key));

      // Handle pagination
      let startIndex = 0;
      if (continuationToken) {
        startIndex = objects.findIndex((obj) => obj.key > continuationToken);
        if (startIndex === -1) {
          startIndex = objects.length;
        }
      }

      const paginatedObjects = objects.slice(startIndex, startIndex + maxKeys);
      const isTruncated = startIndex + maxKeys < objects.length;
      const nextContinuationToken = isTruncated
        ? paginatedObjects[paginatedObjects.length - 1]?.key
        : undefined;

      this.logger.debug('Finished listing objects from filesystem', {
        bucket,
        objectCount: paginatedObjects.length,
        commonPrefixCount: commonPrefixesSet.size,
        isTruncated,
      });

      const result: {
        objects: Array<{ key: string; size: number; lastModified: Date }>;
        commonPrefixes?: string[];
        isTruncated: boolean;
        nextContinuationToken?: string;
      } = {
        objects: paginatedObjects,
        isTruncated,
      };

      if (commonPrefixesSet.size > 0) {
        result.commonPrefixes = Array.from(commonPrefixesSet).sort();
      }

      if (nextContinuationToken) {
        result.nextContinuationToken = nextContinuationToken;
      }

      return Ok(result);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to list objects from filesystem',
        context: { bucket, options },
        errorPrefix: 'Failed to list objects',
      });
    }
  }

  async copyObject(
    source: ObjectLocation,
    destination: ObjectLocation,
  ): Promise<Result<void, string>> {
    this.logger.debug('Copying object on filesystem', {
      sourceBucket: source.bucket,
      sourceKey: source.key,
      destBucket: destination.bucket,
      destKey: destination.key,
    });

    try {
      // Read source object
      const readResult = await this.read(source);
      if (readResult.tag === 'err') {
        return Err(readResult.error);
      }

      // Write to destination
      const writeResult = await this.write({
        bucket: destination.bucket,
        key: destination.key,
        data: readResult.value,
      });

      if (writeResult.tag === 'err') {
        return Err(writeResult.error);
      }

      this.logger.debug('Successfully copied object on filesystem', {
        sourceBucket: source.bucket,
        sourceKey: source.key,
        destBucket: destination.bucket,
        destKey: destination.key,
      });
      return Ok(undefined);
    } catch (error) {
      return handleError(error, {
        logger: this.logger,
        logMessage: 'Failed to copy object on filesystem',
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
