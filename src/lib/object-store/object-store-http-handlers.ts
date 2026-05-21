import type { ObjectStore } from './object-store';
import type { Logger } from '../logger';
import { isOk } from '../result';
import { verifyServerPresignedSignature } from './presigned-url';

/**
 * HTTP handlers for serving presigned URLs from ObjectStore.
 * Handles GET and PUT requests for objects stored in the object store.
 */
export class ObjectStoreHttpHandlers {
  constructor(
    private readonly objectStore: ObjectStore,
    private readonly logger: Logger,
  ) {}

  /**
   * Handle GET request for an object.
   * Validates the presigned URL signature and serves the object.
   */
  async handleGet(req: Request, bucket: string, key: string): Promise<Response> {
    try {
      // Extract query parameters for presigned URL validation
      const url = new URL(req.url);
      const expiresParam = url.searchParams.get('expires');
      const methodParam = url.searchParams.get('method');
      const signatureParam = url.searchParams.get('signature');

      // Validate presigned URL parameters
      if (!expiresParam || !methodParam || !signatureParam) {
        this.logger.warn('Missing presigned URL parameters', {
          bucket,
          key,
          hasExpires: !!expiresParam,
          hasMethod: !!methodParam,
          hasSignature: !!signatureParam,
        });
        return new Response('Invalid presigned URL: missing parameters', { status: 400 });
      }

      const expiresAt = parseInt(expiresParam, 10);
      const method = methodParam.toUpperCase();

      // Validate expiration
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt < now) {
        this.logger.warn('Presigned URL has expired', {
          bucket,
          key,
          expiresAt,
          now,
        });
        return new Response('Presigned URL has expired', { status: 403 });
      }

      // Validate method
      if (method !== 'GET') {
        this.logger.warn('Invalid method in presigned URL', {
          bucket,
          key,
          expected: 'GET',
          actual: method,
        });
        return new Response('Invalid presigned URL: method mismatch', { status: 403 });
      }

      const signatureValid = verifyServerPresignedSignature({
        bucket,
        key,
        method,
        expiresAt,
        signature: signatureParam,
      });
      if (!signatureValid) {
        this.logger.warn('Invalid signature on presigned GET URL', { bucket, key });
        return new Response('Invalid presigned URL: signature mismatch', { status: 403 });
      }

      // Read the object from the store
      const result = await this.objectStore.read({ bucket, key });

      if (!isOk(result)) {
        this.logger.warn('Object not found in store', {
          bucket,
          key,
          error: result.error,
        });
        return new Response('Object not found', { status: 404 });
      }

      const data = result.value;

      // Determine content type (for now, use application/octet-stream as default)
      // In a real implementation, you might want to store content type metadata
      const contentType = 'application/octet-stream';

      this.logger.debug('Serving object via GET', {
        bucket,
        key,
        size: data.length,
        contentType,
      });

      return new Response(new Uint8Array(data), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': data.length.toString(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      });
    } catch (error) {
      this.logger.error('Error handling GET request for object', {
        bucket,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return new Response('Internal server error', { status: 500 });
    }
  }

  /**
   * Handle PUT request for an object.
   * Validates the presigned URL signature and stores the uploaded object.
   */
  async handlePut(req: Request, bucket: string, key: string): Promise<Response> {
    try {
      // Extract query parameters for presigned URL validation
      const url = new URL(req.url);
      const expiresParam = url.searchParams.get('expires');
      const methodParam = url.searchParams.get('method');
      const signatureParam = url.searchParams.get('signature');

      // Validate presigned URL parameters
      if (!expiresParam || !methodParam || !signatureParam) {
        this.logger.warn('Missing presigned URL parameters', {
          bucket,
          key,
          hasExpires: !!expiresParam,
          hasMethod: !!methodParam,
          hasSignature: !!signatureParam,
        });
        return new Response('Invalid presigned URL: missing parameters', { status: 400 });
      }

      const expiresAt = parseInt(expiresParam, 10);
      const method = methodParam.toUpperCase();

      // Validate expiration
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt < now) {
        this.logger.warn('Presigned URL has expired', {
          bucket,
          key,
          expiresAt,
          now,
        });
        return new Response('Presigned URL has expired', { status: 403 });
      }

      // Validate method
      if (method !== 'PUT') {
        this.logger.warn('Invalid method in presigned URL', {
          bucket,
          key,
          expected: 'PUT',
          actual: method,
        });
        return new Response('Invalid presigned URL: method mismatch', { status: 403 });
      }

      const signatureValid = verifyServerPresignedSignature({
        bucket,
        key,
        method,
        expiresAt,
        signature: signatureParam,
      });
      if (!signatureValid) {
        this.logger.warn('Invalid signature on presigned PUT URL', { bucket, key });
        return new Response('Invalid presigned URL: signature mismatch', { status: 403 });
      }

      // Get the request body
      const arrayBuffer = await req.arrayBuffer();
      const data = Buffer.from(arrayBuffer);

      // Get content type from request headers
      const contentType = req.headers.get('content-type') || 'application/octet-stream';

      // Write the object to the store
      const result = await this.objectStore.write({
        bucket,
        key,
        data,
        contentType,
      });

      if (!isOk(result)) {
        this.logger.error('Failed to write object to store', {
          bucket,
          key,
          error: result.error,
        });
        return new Response('Failed to store object', { status: 500 });
      }

      this.logger.debug('Stored object via PUT', {
        bucket,
        key,
        size: data.length,
        contentType,
      });

      return new Response('Object stored successfully', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
        },
      });
    } catch (error) {
      this.logger.error('Error handling PUT request for object', {
        bucket,
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return new Response('Internal server error', { status: 500 });
    }
  }
}
