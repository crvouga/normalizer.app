import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { serve } from 'bun';
import { createLogger } from './lib/logger';
import { createContext } from './lib/trpc-server';
import clientHtml from './client.html';
import { appRouter } from './trpc-server';
import { createS3 } from './s3';
import { cleanupDb, createDb } from './sql';

const main = async () => {
  const logger = createLogger();

  // Setup graceful shutdown handlers
  const setupGracefulShutdown = () => {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await cleanupDb(logger);
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));
  };

  setupGracefulShutdown();

  const db = await createDb({ logger });

  const s3 = await createS3({ logger });

  const trpcContext = createContext({ db, s3, logger });

  logger.info('Starting server...');
  const server = serve({
    port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
    routes: {
      // tRPC endpoint
      '/api/trpc/*': {
        async GET(req) {
          logger.info(`[HTTP Req] GET ${req.url}`);
          const res = await fetchRequestHandler({
            endpoint: '/api/trpc',
            req,
            router: appRouter,
            createContext: () => trpcContext,
          });
          logger.info(`[HTTP Res] ${res.status} ${res.statusText}`);
          return res;
        },
        async POST(req) {
          logger.info(`[HTTP Req] POST ${req.url}`);
          const res = await fetchRequestHandler({
            endpoint: '/api/trpc',
            req,
            router: appRouter,
            createContext: () => trpcContext,
          });
          logger.info(`[HTTP Res] ${res.status} ${res.statusText}`);
          return res;
        },
      },

      '/api/hello': {
        async GET(req) {
          return Response.json({
            message: 'Hello, world!',
            method: 'GET',
          });
        },
        async PUT(req) {
          return Response.json({
            message: 'Hello, world!',
            method: 'PUT',
          });
        },
      },

      async '/api/hello/:name'(req) {
        const name = req.params.name;
        return Response.json({
          message: `Hello, ${name}!`,
        });
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
