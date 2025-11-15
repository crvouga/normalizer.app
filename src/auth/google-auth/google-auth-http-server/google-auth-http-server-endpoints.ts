import type { S3Client } from 'bun';
import type { Logger } from '../../../lib/logger';
import type { Db } from '../../../shared/sql';
import {
  handleGoogleAuthStart,
  handleGoogleAuthCallback,
} from './google-auth-http-server-handlers';

/**
 * Create Google OAuth HTTP endpoints
 * These are kept separate from tRPC as Google OAuth requires standard HTTP redirects
 */
export function createGoogleAuthEndpoints(config: {
  db: Db;
  s3: S3Client;
  s3Endpoint: string;
  logger: Logger;
}) {
  return {
    '/api/auth/google': {
      GET: async (req: Request) => handleGoogleAuthStart(req, config),
    },

    '/api/auth/google/callback': {
      GET: async (req: Request) => handleGoogleAuthCallback(req, config),
    },
  };
}
