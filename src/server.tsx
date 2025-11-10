import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { serve } from 'bun';
import { createLogger } from './lib/logger';
import { createContext } from './lib/trpc-server';
import clientHtml from './client.html';
import { appRouter } from './trpc-server';
import { createS3 } from './s3';
import { getS3Config } from './s3-config';
import { cleanupDb, createDb } from './sql';
import { setSessionCookie, getSessionId } from './lib/session-id-cookie';
import { createGoogleAuthEndpoints } from './auth/google-auth-endpoints';

const main = async () => {
  const logger = createLogger();

  // Setup graceful shutdown handlers
  const setupGracefulShutdown = () => {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await cleanupDb(logger);
      process.exit(0);
    };

    ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => process.on(signal, () => shutdown(signal)));
  };

  setupGracefulShutdown();

  const db = await createDb({ logger });

  const { s3Endpoint } = getS3Config();
  const { s3Client, minioClient } = await createS3({ logger });

  logger.info('Starting server...');

  // DRY up tRPC handler
  const trpcHandler = (method: 'GET' | 'POST') => async (req: Request) => {
    logger.info(`[HTTP Req] ${method} ${req.url}`);
    const res = await fetchRequestHandler({
      endpoint: '/api/trpc',
      req,
      router: appRouter,
      createContext: async () => {
        const context = await createContext({
          db,
          s3: s3Client,
          s3Endpoint,
          minioClient,
          logger,
          req,
        });
        return context;
      },
    });

    // Set session cookie if not already set
    const finalRes = setSessionCookie(req, res, getSessionId(req));
    logger.info(`[HTTP Res] ${finalRes.status} ${finalRes.statusText}`);
    return finalRes;
  };

  // Google OAuth endpoints
  const googleAuthEndpoints = createGoogleAuthEndpoints({ db, logger });

  const server = serve({
    port: process.env.PORT ? parseInt(process.env.PORT) : 5000,

    routes: {
      // Google OAuth endpoints
      ...googleAuthEndpoints,

      // tRPC endpoint
      '/api/trpc/*': {
        GET: trpcHandler('GET'),
        POST: trpcHandler('POST'),
      },

      async '/health'() {
        return Response.json({ status: 'ok' });
      },

      '/*': clientHtml,
    },

    development: process.env.NODE_ENV !== 'production',
  });

  logger.info(`🚀 Server running at ${server.url}`);
};

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
