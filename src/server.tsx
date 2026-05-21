import { serve } from 'bun';
import { sql } from 'drizzle-orm';
import { createGoogleAuthEndpoints } from './auth/google-auth/google-auth-http-server/google-auth-http-server-endpoints';
import clientHtml from './client.html';
import { assertPortNotUsed } from './lib/assert-port-not-used';
import { ensureGraphileWorkerSetup } from './lib/graphile-worker-lib';
import { createLogger, type Logger } from './lib/logger';
import type { ObjectStore } from './lib/object-store/object-store';
import { createObjectStoreEndpoints } from './lib/object-store/object-store-http-endpoints';
import { isOk } from './lib/result';
import type { Db } from './shared/db';
import { createDb } from './shared/db';
import { createObjectStore } from './shared/s3';
import { createTrpcEndpoints } from './trpc-server/trpc-http-endpoints';
import { generateSparklesSvg } from './ui/sparkles-svg-generate';
import { createUserProfilePictureEndpoints } from './users/user-profile-picture-http-server';

const SLOW_DB_PING_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 30_000;

type ComponentStatus = {
  ok: boolean;
  latency_ms: number;
  error?: string;
  detail?: Record<string, unknown>;
};

async function checkDb(db: Db): Promise<ComponentStatus> {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    return { ok: true, latency_ms: Date.now() - start };
  } catch (error) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkObjectStore(objectStore: ObjectStore): Promise<ComponentStatus> {
  const start = Date.now();
  try {
    const result = await objectStore.getEndpointInfo();
    if (isOk(result)) {
      return {
        ok: true,
        latency_ms: Date.now() - start,
        detail: { base_url: result.value.baseUrl, use_https: result.value.useHTTPS },
      };
    }
    return { ok: false, latency_ms: Date.now() - start, error: result.error };
  } catch (error) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Continuously pings the database so a stale loopback connection is logged
 * (and counted as unhealthy by /health) even when the server is idle. This
 * is the early-warning system for the Fly suspend/resume class of bug.
 */
function startDbHeartbeat(db: Db, logger: Logger): () => void {
  let lastOk: boolean | null = null;
  const tick = async () => {
    const status = await checkDb(db);
    if (status.ok) {
      if (lastOk === false) {
        logger.info('DB heartbeat recovered', { latency_ms: status.latency_ms });
      } else if (status.latency_ms > SLOW_DB_PING_MS) {
        logger.warn('DB heartbeat slow', { latency_ms: status.latency_ms });
      }
    } else {
      logger.error('DB heartbeat failed', {
        latency_ms: status.latency_ms,
        error: status.error,
      });
    }
    lastOk = status.ok;
  };
  void tick();
  const interval = setInterval(() => {
    void tick();
  }, HEARTBEAT_INTERVAL_MS);
  return () => clearInterval(interval);
}

async function main() {
  const logger = createLogger().child('Server');

  logger.info('Process info', {
    bun_version: Bun.version,
    pid: process.pid,
    node_env: process.env.NODE_ENV ?? 'development',
    server_base_url: process.env.SERVER_BASE_URL ?? '(unset, falling back to localhost)',
    port: process.env.PORT ?? '8080',
    fly_app: process.env.FLY_APP_NAME,
    fly_region: process.env.FLY_REGION,
    fly_machine_id: process.env.FLY_MACHINE_ID,
  });

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

  const stopHeartbeat = startDbHeartbeat(db, logger);

  const server = serve({
    hostname: '0.0.0.0',
    port,

    routes: {
      ...googleAuthEndpoints,

      ...profilePictureEndpoints,

      ...objectStoreEndpoints,

      ...trpcEndpoints,

      async '/health'() {
        // Cheap; intended for Fly's [[http_service.checks]]. Probes the
        // database only -- if that's stale the whole machine is broken,
        // so Fly should replace it instead of letting requests hang for
        // minutes on a TCP keepalive timeout.
        const start = Date.now();
        const dbStatus = await checkDb(db);
        if (!dbStatus.ok) {
          logger.warn('Health check failed', {
            component: 'db',
            latency_ms: dbStatus.latency_ms,
            error: dbStatus.error,
          });
        }
        return Response.json(
          {
            status: dbStatus.ok ? 'ok' : 'unhealthy',
            uptime_s: Math.floor(process.uptime()),
            elapsed_ms: Date.now() - start,
            components: { db: dbStatus },
          },
          {
            status: dbStatus.ok ? 200 : 503,
            headers: { 'Cache-Control': 'no-store' },
          },
        );
      },

      async '/health/deep'() {
        // Verbose; for manual debugging. Probes db AND object store.
        const start = Date.now();
        const [dbStatus, objStatus] = await Promise.all([
          checkDb(db),
          checkObjectStore(objectStore),
        ]);
        const allOk = dbStatus.ok && objStatus.ok;
        return Response.json(
          {
            status: allOk ? 'ok' : 'unhealthy',
            uptime_s: Math.floor(process.uptime()),
            elapsed_ms: Date.now() - start,
            process: {
              bun_version: Bun.version,
              pid: process.pid,
              node_env: process.env.NODE_ENV ?? null,
              fly_machine_id: process.env.FLY_MACHINE_ID ?? null,
            },
            components: {
              db: dbStatus,
              objectStore: objStatus,
            },
          },
          {
            status: allOk ? 200 : 503,
            headers: { 'Cache-Control': 'no-store' },
          },
        );
      },

      '/*': clientHtml,
    },
    development: process.env.NODE_ENV !== 'production',
    idleTimeout: 255,
  });

  process.on('SIGTERM', stopHeartbeat);
  process.on('SIGINT', stopHeartbeat);

  logger.info(`🚀 Server running at ${server.url}`);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
