import { RPCHandler } from '@orpc/server/fetch';
import { serve } from 'bun';
import { createLogger } from './lib/logger';
import clientHtml from './client.html';
import { createRouter } from './orpc-server';
import { createS3 } from './s3';
import { cleanupSQL, createSQL } from './sql';

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
  const appRouter = createRouter({
    sql,
    s3,
    logger,
  });

  // Create oRPC handler
  const rpcHandler = new RPCHandler(appRouter, {});

  logger.info('Starting server...');
  const server = serve({
    port: process.env.PORT ? parseInt(process.env.PORT) : 5000,
    routes: {
      '/*': clientHtml,

      // oRPC endpoint
      '/api/orpc/*': async (req) => {
        const res = await rpcHandler.handle(req);
        if (res.matched) {
          return res.response;
        }
        return new Response('Not Found', { status: 404 });
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
