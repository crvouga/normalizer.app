import { serve } from 'bun';
import { createGoogleAuthEndpoints } from './auth/google-auth/google-auth-http-server/google-auth-http-server-endpoints';
import clientHtml from './client.html';
import { assertPortNotUsed } from './lib/assert-port-not-used';
import { ensureGraphileWorkerSetup } from './lib/graphile-worker-lib';
import { createLogger } from './lib/logger';
import { createObjectStoreEndpoints } from './lib/object-store/object-store-http-endpoints';
import { createDb } from './shared/db';
import { createObjectStore } from './shared/s3';
import { createTrpcEndpoints } from './trpc-server/trpc-http-endpoints';
import { generateSparklesSvg } from './ui/sparkles-svg-generate';
import { createUserProfilePictureEndpoints } from './users/user-profile-picture-http-server';

async function main() {
  const logger = createLogger().child('Server');

  await generateSparklesSvg({ logger });

  const db = await createDb({ logger });

  await ensureGraphileWorkerSetup({ db, logger });

  const port = process.env.PORT ? parseInt(process.env.PORT) : 8080;

  const serverBaseUrl = process.env.SERVER_BASE_URL || `http://localhost:${port}`;

  const objectStore = await createObjectStore({ logger, serverBaseUrl });

  const googleAuthEndpoints = createGoogleAuthEndpoints({ db, objectStore, logger });

  const profilePictureEndpoints = createUserProfilePictureEndpoints({ objectStore, logger });

  const objectStoreEndpoints = createObjectStoreEndpoints({ objectStore, logger });

  const trpcEndpoints = createTrpcEndpoints({ db, objectStore, logger });

  await assertPortNotUsed({ port, logger });

  const server = serve({
    hostname: '0.0.0.0',
    port,

    routes: {
      ...googleAuthEndpoints,

      ...profilePictureEndpoints,

      ...objectStoreEndpoints,

      ...trpcEndpoints,

      async '/health'() {
        return Response.json({ status: 'ok' });
      },

      '/*': clientHtml,
    },
    development: process.env.NODE_ENV !== 'production',
    idleTimeout: 255,
  });

  logger.info(`🚀 Server running at ${server.url}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
