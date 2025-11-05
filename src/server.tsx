import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { serve } from 'bun';
import { createLogger } from './lib/logger';
import { createContext } from './lib/trpc-server';
import clientHtml from './client.html';
import { appRouter } from './trpc-server';
import { createS3 } from './s3';
import { cleanupSQL, createSQL } from './sql';
import { FileUploadRecordDb } from './file-upload/file-upload-record-db';

const main = async () => {
  const logger = createLogger();

  // Setup graceful shutdown handlers
  const setupGracefulShutdown = () => {
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, shutting down gracefully...`);
      await cleanupSQL(logger);
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGHUP', () => shutdown('SIGHUP'));
  };

  setupGracefulShutdown();

  const sql = await createSQL({ logger });
  const s3 = await createS3({ logger });

  const fileUploadRecordDb = new FileUploadRecordDb({ sql, logger });
  await fileUploadRecordDb.migrate();

  logger.info('Starting server...');
  const server = serve({
    port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
    routes: {
      '/*': clientHtml,

      // tRPC endpoint
      '/api/trpc/*': async (req) => {
        return fetchRequestHandler({
          endpoint: '/api/trpc',
          req,
          router: appRouter,
          createContext: () => createContext({ sql, s3, logger }),
        });
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

      '/api/hello/:name': async (req) => {
        const name = req.params.name;
        return Response.json({
          message: `Hello, ${name}!`,
        });
      },

      '/health': async () => {
        return Response.json({ status: 'ok' });
      },
    },

    development: process.env.NODE_ENV !== 'production',
  });

  logger.info(`🚀 Server running at ${server.url}`);
};

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
