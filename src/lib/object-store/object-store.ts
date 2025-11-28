import type { Result } from '../result';
import type { ObjectLocation } from './object-location';

/**
 * Object store interface for storing and retrieving binary objects.
 * Provides a simple, app-agnostic abstraction over object storage backends.
 * Batch methods are the core implementation; single methods are convenience wrappers.
 */
export interface ObjectStore {
  /**
   * Read multiple objects from storage.
   * @param locations Array of object locations to read
   * @returns Result containing an array of objects with data, in the same order as input
   */
  readMany(
    locations: ObjectLocation[],
  ): Promise<Result<Array<ObjectLocation & { data: Buffer | null }>, string>>;

  /**
   * Read an object from storage.
   * Convenience wrapper around readMany.
   * @param params Object containing bucket and key
   * @returns Result containing the object data as a Buffer, or an error message
   */
  read(params: ObjectLocation): Promise<Result<Buffer, string>>;

  /**
   * Write multiple objects to storage.
   * Overwrites existing objects if they already exist.
   * @param entries Array of objects to write, each containing location, data, and optional contentType
   * @returns Result containing an array of ObjectLocations that were written to, in the same order as input
   */
  writeMany(
    entries: Array<ObjectLocation & { data: Buffer; contentType?: string }>,
  ): Promise<Result<ObjectLocation[], string>>;

  /**
   * Write an object to storage.
   * Convenience wrapper around writeMany.
   * Overwrites existing objects if they already exist.
   * @param params Object containing bucket, key, data, and optional contentType
   * @returns Result containing the key and bucket that were written to, or an error message
   */
  write(
    params: ObjectLocation & { data: Buffer; contentType?: string },
  ): Promise<Result<ObjectLocation, string>>;

  /**
   * Check if multiple objects exist in storage.
   * @param locations Array of object locations to check
   * @returns Result containing an array of objects with exists flag, in the same order as input
   */
  existsMany(
    locations: ObjectLocation[],
  ): Promise<Result<Array<ObjectLocation & { exists: boolean }>, string>>;

  /**
   * Check if an object exists in storage.
   * Convenience wrapper around existsMany.
   * @param params Object containing bucket and key
   * @returns Result containing true if object exists, false otherwise, or an error message
   */
  exists(params: ObjectLocation): Promise<Result<boolean, string>>;

  /**
   * Delete multiple objects from storage.
   * Succeeds even if some objects don't exist.
   * @param locations Array of object locations to delete
   * @returns Result indicating success or failure
   */
  deleteMany(locations: ObjectLocation[]): Promise<Result<void, string>>;

  /**
   * Delete an object from storage.
   * Convenience wrapper around deleteMany.
   * Succeeds even if the object doesn't exist.
   * @param params Object containing bucket and key
   * @returns Result indicating success or failure
   */
  delete(params: ObjectLocation): Promise<Result<void, string>>;

  /**
   * Check if a bucket exists.
   * @param bucket Bucket name to check
   * @returns Result containing true if bucket exists, false otherwise, or an error message
   */
  bucketExists(bucket: string): Promise<Result<boolean, string>>;

  /**
   * Create a bucket.
   * Succeeds even if the bucket already exists (idempotent).
   * @param bucket Bucket name to create
   * @returns Result indicating success or failure
   */
  createBucket(bucket: string): Promise<Result<void, string>>;

  /**
   * Ensure a bucket exists, creating it if necessary.
   * This is a convenience method that combines bucketExists and createBucket.
   * @param bucket Bucket name to ensure exists
   * @returns Result indicating success or failure
   */
  ensureBucketExists(bucket: string): Promise<Result<void, string>>;

  /**
   * Generate presigned URLs for multiple objects.
   * @param entries Array of objects, each containing location, method, expiresIn, and optional useHTTPS
   * @returns Result containing an array of objects with presigned URLs, in the same order as input
   */
  presignMany(
    entries: Array<
      ObjectLocation & { method: 'GET' | 'PUT'; expiresIn: number; useHTTPS?: boolean }
    >,
  ): Promise<Result<Array<ObjectLocation & { url: string }>, string>>;

  /**
   * Generate a presigned URL for an object.
   * Convenience wrapper around presignMany.
   * @param params Object containing bucket, key, HTTP method (GET or PUT), expiration time in seconds, and optional useHTTPS flag
   * @returns Result containing the presigned URL, or an error message
   */
  presign(
    params: ObjectLocation & { method: 'GET' | 'PUT'; expiresIn: number; useHTTPS?: boolean },
  ): Promise<Result<string, string>>;

  /**
   * Get endpoint metadata including base URL and HTTPS preference.
   * @returns Result containing base URL (protocol + host) and whether HTTPS should be used
   */
  getEndpointInfo(): Promise<Result<{ baseUrl: string; useHTTPS: boolean }, string>>;
}
