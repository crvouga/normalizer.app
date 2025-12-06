import type { ObjectStore } from '../../../lib/object-store/object-store';
import type { Logger } from '../../../lib/logger';
import type { Db } from '../../../shared/db';
import { GoogleAuthHttpServerHandlers } from './google-auth-http-server-handlers';

/**
 * Create Google OAuth HTTP endpoints
 * These are kept separate from tRPC as Google OAuth requires standard HTTP redirects
 */
export function createGoogleAuthEndpoints(config: {
  db: Db;
  objectStore: ObjectStore;
  logger: Logger;
}) {
  const handlers = new GoogleAuthHttpServerHandlers(config);

  return {
    '/api/auth/google': {
      GET: async (req: Request) => handlers.handleGoogleAuthStart(req),
    },

    '/api/auth/google/callback': {
      GET: async (req: Request) => handlers.handleGoogleAuthCallback(req),
    },
  };
}
