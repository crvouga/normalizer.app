import type { ObjectStore } from './object-store';
import type { Logger } from '../logger';
import { ObjectStoreHttpHandlers } from './object-store-http-handlers';

/**
 * Create HTTP endpoints for object store presigned URLs.
 * Returns route handlers that can be added to Bun's serve() routes.
 */
export function createObjectStoreEndpoints(config: { objectStore: ObjectStore; logger: Logger }) {
  const { objectStore, logger } = config;
  const handlers = new ObjectStoreHttpHandlers(objectStore, logger);

  return {
    '/api/objects/:bucket/:key': {
      GET: async (req: Request) => {
        try {
          // Extract bucket and key from URL path
          const url = new URL(req.url);
          const pathParts = url.pathname.split('/');
          // Path format: /api/objects/{bucket}/{key}
          const bucket = decodeURIComponent(pathParts[3] || '');
          const key = decodeURIComponent(pathParts.slice(4).join('/') || '');

          if (!bucket || !key) {
            return new Response('Invalid bucket or key', { status: 400 });
          }

          return await handlers.handleGet(req, bucket, key);
        } catch (error) {
          logger.error('Error in GET endpoint', {
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response('Internal server error', { status: 500 });
        }
      },
      PUT: async (req: Request) => {
        try {
          // Extract bucket and key from URL path
          const url = new URL(req.url);
          const pathParts = url.pathname.split('/');
          // Path format: /api/objects/{bucket}/{key}
          const bucket = decodeURIComponent(pathParts[3] || '');
          const key = decodeURIComponent(pathParts.slice(4).join('/') || '');

          if (!bucket || !key) {
            return new Response('Invalid bucket or key', { status: 400 });
          }

          return await handlers.handlePut(req, bucket, key);
        } catch (error) {
          logger.error('Error in PUT endpoint', {
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response('Internal server error', { status: 500 });
        }
      },
    },
  };
}
