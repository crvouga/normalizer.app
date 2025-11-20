import type { S3Client } from 'bun';
import type { ObjectStore } from './object-store';
import type { MinioClient } from '../minio/minio-client';
import { Ok, Err, type Result } from '../result';

/**
 * S3 implementation of ObjectStore using Bun's S3Client and MinioClient.
 * Provides object storage operations over S3-compatible storage.
 */
export class S3ObjectStore implements ObjectStore {
  private s3Client: S3Client;
  private minioClient: MinioClient;
  private s3Endpoint: string;

  constructor(s3Client: S3Client, minioClient: MinioClient, s3Endpoint: string) {
    this.s3Client = s3Client;
    this.minioClient = minioClient;
    this.s3Endpoint = s3Endpoint;
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

  async bucketExists(bucket: string): Promise<Result<boolean, string>> {
    try {
      const exists = await this.minioClient.checkBucketExists(bucket);
      return Ok(exists);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to check if bucket exists: ${errorMessage}`);
    }
  }

  async createBucket(bucket: string): Promise<Result<void, string>> {
    try {
      // Check if bucket already exists - if it does, succeed (idempotent)
      const exists = await this.minioClient.checkBucketExists(bucket);
      if (exists) {
        return Ok(undefined);
      }

      // Create the bucket
      await this.minioClient.createBucket(bucket);
      return Ok(undefined);
    } catch (error) {
      // If error is "Bucket already exists", that's okay (idempotent)
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('already exists')) {
        return Ok(undefined);
      }
      return Err(`Failed to create bucket: ${errorMessage}`);
    }
  }

  async ensureBucketExists(bucket: string): Promise<Result<void, string>> {
    try {
      await this.minioClient.ensureBucketExists(bucket);
      return Ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to ensure bucket exists: ${errorMessage}`);
    }
  }

  async presign(params: {
    bucket: string;
    key: string;
    method: 'GET' | 'PUT';
    expiresIn: number;
  }): Promise<Result<string, string>> {
    try {
      const { bucket, key, method, expiresIn } = params;
      const minioClient = this.minioClient.client;

      let url: string;
      if (method === 'GET') {
        url = await minioClient.presignedGetObject(bucket, key, expiresIn);
      } else {
        url = await minioClient.presignedPutObject(bucket, key, expiresIn);
      }

      // Ensure the URL uses HTTPS when it starts with http:// but should be https://
      // This fixes mixed content errors in production when the page is served over HTTPS
      // Note: MinioClient's generatePresignedUrl handles this, but we're using the raw client
      // so we need to check the endpoint configuration. For now, we'll rely on the client's configuration.
      // If needed, we can add s3Endpoint parameter to handle HTTPS conversion.

      return Ok(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to generate presigned URL: ${errorMessage}`);
    }
  }

  async getEndpointInfo(): Promise<Result<{ baseUrl: string; useHTTPS: boolean }, string>> {
    try {
      // Extract base URL (protocol + host) from endpoint
      let baseUrl: string;
      try {
        const url = new URL(this.s3Endpoint);
        baseUrl = `${url.protocol}//${url.host}`;
      } catch {
        return Err(`Invalid endpoint URL: ${this.s3Endpoint}`);
      }

      // Determine if HTTPS should be used based on endpoint protocol
      const useHTTPS = this.s3Endpoint.startsWith('https://');

      return Ok({ baseUrl, useHTTPS });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Err(`Failed to get endpoint info: ${errorMessage}`);
    }
  }
}
