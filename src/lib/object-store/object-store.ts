import type { Result } from '../result';

/**
 * Object store interface for storing and retrieving binary objects.
 * Provides a simple, app-agnostic abstraction over object storage backends.
 */
export interface ObjectStore {
  /**
   * Read an object from storage.
   * @param params Object containing bucket and key
   * @returns Result containing the object data as a Buffer, or an error message
   */
  read(params: { bucket: string; key: string }): Promise<Result<Buffer, string>>;

  /**
   * Write an object to storage.
   * Overwrites existing objects if they already exist.
   * @param params Object containing bucket, key, data, and optional contentType
   * @returns Result indicating success or failure
   */
  write(params: {
    bucket: string;
    key: string;
    data: Buffer;
    contentType?: string;
  }): Promise<Result<void, string>>;

  /**
   * Check if an object exists in storage.
   * @param params Object containing bucket and key
   * @returns Result containing true if object exists, false otherwise, or an error message
   */
  exists(params: { bucket: string; key: string }): Promise<Result<boolean, string>>;

  /**
   * Delete an object from storage.
   * Succeeds even if the object doesn't exist.
   * @param params Object containing bucket and key
   * @returns Result indicating success or failure
   */
  delete(params: { bucket: string; key: string }): Promise<Result<void, string>>;

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
   * Generate a presigned URL for an object.
   * @param params Object containing bucket, key, HTTP method (GET or PUT), and expiration time in seconds
   * @returns Result containing the presigned URL, or an error message
   */
  presign(params: {
    bucket: string;
    key: string;
    method: 'GET' | 'PUT';
    expiresIn: number;
  }): Promise<Result<string, string>>;
}
