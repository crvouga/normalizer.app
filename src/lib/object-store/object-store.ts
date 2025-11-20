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
}
