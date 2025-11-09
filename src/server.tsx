import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { serve } from 'bun';
import { createLogger } from './lib/logger';
import { createContext } from './lib/trpc-server';
import clientHtml from './client.html';
import { appRouter } from './trpc-server';
import { createS3 } from './s3';
import { cleanupDb, createDb } from './sql';
import { setSessionCookie } from './lib/session-id-cookie';
import { SessionId } from './lib/session-id';

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

  const { s3Client, minioClient } = await createS3({ logger });

  const trpcContext = createContext({ db, s3: s3Client, minioClient, logger });

  logger.info('Starting server...');

  // DRY up tRPC handler
  const trpcHandler = (method: 'GET' | 'POST') => async (req: Request) => {
    logger.info(`[HTTP Req] ${method} ${req.url}`);
    const res = await fetchRequestHandler({
      endpoint: '/api/trpc',
      req,
      router: appRouter,
      createContext: () => trpcContext,
    });
    logger.info(`[HTTP Res] ${res.status} ${res.statusText}`);
    return res;
  };

  const server = serve({
    port: process.env.PORT ? parseInt(process.env.PORT) : 5000,

    routes: {
      '/api/set-session-id-cookie': {
        POST: async (req) => setSessionCookie(req, new Response(), SessionId.generate()),
      },

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
