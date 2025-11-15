import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { serve } from 'bun';
import { appRouter } from './app-trpc-server';
import { createGoogleAuthEndpoints } from './auth/google-auth/google-auth-http-server/google-auth-http-server-endpoints';
import clientHtml from './client.html';
import { createLogger } from './lib/logger';
import { createS3 } from './shared/s3';
import { getS3Config } from './shared/s3-config';
import { SessionId } from './shared/session-id';
import { getSessionId, setSessionCookie } from './shared/session-id-cookie';
import { cleanupDb, createDb } from './shared/sql';
import { createContext } from './shared/trpc-server';
import { generateSparklesSvg } from './ui/sparkles-svg-generate';
import { createUserProfilePictureEndpoints } from './users/user-profile-picture-http-server';

const main = async () => {
  const logger = createLogger();

  generateSparklesSvg(logger);

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
    const existingSessionId = getSessionId(req);
    const sessionId = existingSessionId ?? SessionId.generate();
    const finalRes = setSessionCookie(req, res, sessionId);
    logger.info(`[HTTP Res] ${finalRes.status} ${finalRes.statusText}`);
    return finalRes;
  };

  // Google OAuth endpoints
  const googleAuthEndpoints = createGoogleAuthEndpoints({ db, s3: s3Client, s3Endpoint, logger });

  // User profile picture endpoints
  const profilePictureEndpoints = createUserProfilePictureEndpoints({ s3: s3Client, logger });

  const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;

  try {
    const server = serve({
      port,

      routes: {
        // Google OAuth endpoints
        ...googleAuthEndpoints,

        // User profile picture endpoints
        ...profilePictureEndpoints,

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
};

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
