import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { serve } from 'bun';
import { appRouter } from './app-trpc-server';
import { createGoogleAuthEndpoints } from './auth/google-auth/google-auth-http-server/google-auth-http-server-endpoints';
import clientHtml from './client.html';
import { createLogger } from './lib/logger';
import { getOrGenerateTraceId, setTraceIdHeader } from './lib/trace-id';
import { cleanupDb, createDb } from './shared/db';
import { createObjectStore } from './shared/s3';
import { SessionId } from './shared/session-id';
import { getSessionId, setSessionCookie } from './shared/session-id-cookie';
import { createContext } from './shared/trpc-server';
import { generateSparklesSvg } from './ui/sparkles-svg-generate';
import { createUserProfilePictureEndpoints } from './users/user-profile-picture-http-server';

async function main() {
  const rootLogger = createLogger();

  const logger = rootLogger.child('Server');

  generateSparklesSvg(logger);

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

  const objectStore = await createObjectStore({ logger });

  logger.info('Starting server...');

  const trpcHandler = (method: 'GET' | 'POST') => async (req: Request) => {
    const traceId = getOrGenerateTraceId(req);
    const requestLogger = logger.child(traceId);
    requestLogger.info(`Received ${method} request`, { url: req.url });
    const res = await fetchRequestHandler({
      endpoint: '/api/trpc',
      req,
      router: appRouter,
      createContext: async () => {
        const context = await createContext({
          db,
          objectStore,
          logger: requestLogger,
          req,
        });
        return context;
      },
    });
    const existingSessionId = getSessionId(req);
    const sessionId = existingSessionId ?? SessionId.generate();
    const finalRes = setTraceIdHeader(setSessionCookie(req, res, sessionId), traceId);
    requestLogger.info(`Sent response`, {
      status: finalRes.status,
      statusText: finalRes.statusText,
    });
    return finalRes;
  };

  const googleAuthEndpoints = createGoogleAuthEndpoints({ db, objectStore, logger });

  const profilePictureEndpoints = createUserProfilePictureEndpoints({ objectStore, logger });

  const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;

  try {
    const server = serve({
      port,

      routes: {
        ...googleAuthEndpoints,

        ...profilePictureEndpoints,

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
      idleTimeout: 255,
    });

    logger.info(`🚀 Server running at ${server.url}`);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EADDRINUSE') {
      logger.error(
        `Port ${port} is already in use. Please stop the existing server or use a different port (set PORT environment variable).`,
      );
      logger.error(
        `To find and kill the process using port ${port}, run: lsof -ti:${port} | xargs kill -9`,
      );
    } else {
      logger.error('Failed to start server:', error as Record<string, unknown>);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
