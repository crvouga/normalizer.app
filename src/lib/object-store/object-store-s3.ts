import type { S3Client } from 'bun';
import type { ObjectStore } from './object-store';
import { Ok, Err, type Result } from '../result';

/**
 * S3 implementation of ObjectStore using Bun's S3Client.
 * Provides object storage operations over S3-compatible storage.
 */
export class S3ObjectStore implements ObjectStore {
  private s3Client: S3Client;

  constructor(s3Client: S3Client) {
    this.s3Client = s3Client;
  }

  async read(params: { bucket: string; key: string }): Promise<Result<Buffer, string>> {
    try {
      const { bucket, key } = params;
      const file = this.s3Client.file(key, { bucket });

      if (!(await file.exists())) {
        return Err(`Object not found: ${bucket}/${key}`);
      }

      const arrayBuffer = await file.arrayBuffer();
      return Ok(Buffer.from(arrayBuffer));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to read object: ${errorMessage}`);
    }
  }

  async write(params: {
    bucket: string;
    key: string;
    data: Buffer;
    contentType?: string;
  }): Promise<Result<void, string>> {
    try {
      const { bucket, key, data, contentType } = params;
      await this.s3Client.file(key, { bucket }).write(data, {
        type: contentType ?? '',
      });
      return Ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to write object: ${errorMessage}`);
    }
  }

  async exists(params: { bucket: string; key: string }): Promise<Result<boolean, string>> {
    try {
      const { bucket, key } = params;
      const file = this.s3Client.file(key, { bucket });
      const exists = await file.exists();
      return Ok(exists);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to check if object exists: ${errorMessage}`);
    }
  }

  async delete(params: { bucket: string; key: string }): Promise<Result<void, string>> {
    try {
      const { bucket, key } = params;
      const file = this.s3Client.file(key, { bucket });

      // Check if file exists first - delete should succeed even if it doesn't exist
      const fileExists = await file.exists();
      if (!fileExists) {
        return Ok(undefined);
      }

      // Try to delete using the file's delete method
      // Bun's S3Client file object should have a delete method
      if (typeof (file as any).delete === 'function') {
        await (file as any).delete();
      } else {
        // Fall back: try unlink (note: unlink may use default bucket from S3Client config)
        // This is a limitation - if bucket is not the default, this may not work correctly
        await this.s3Client.unlink(key);
      }

      return Ok(undefined);
    } catch (error) {
      // Delete should succeed even if object doesn't exist
      // Check if it still exists - if not, consider it successful
      try {
        const { bucket, key } = params;
        const file = this.s3Client.file(key, { bucket });
        const stillExists = await file.exists();
        if (stillExists) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return Err(`Failed to delete object: ${errorMessage}`);
        }
        // Object doesn't exist anymore, so deletion succeeded
        return Ok(undefined);
      } catch {
        // If we can't check existence, return the original error
        const errorMessage = error instanceof Error ? error.message : String(error);
        return Err(`Failed to delete object: ${errorMessage}`);
      }
    }
  }
}
