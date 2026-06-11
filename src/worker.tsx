import { loadVaultSecrets } from './lib/secrets/load-vault-secrets';
import { normalizeEnvAliases } from './lib/secrets/normalize-env-aliases';
import { ensureGraphileWorkerSetup } from './lib/graphile-worker-lib';
import { createLogger } from './lib/logger';
import { onShutdown } from './lib/process/on-shutdown';
import { startGraphileWorker } from './lib/start-graphile-worker';
import { createDb } from './shared/db';

/**
 * Standalone Graphile Worker entrypoint.
 *
 * Runs in its own Fly process group / machine so that CPU- and memory-heavy
 * normalization jobs (PGlite WASM, tabular parsing, LLM calls) never starve
 * the web server's event loop and trip its liveness health check.
 */
async function main() {
  await loadVaultSecrets();
  normalizeEnvAliases();

  const logger = createLogger().child('Worker');

  logger.info('Process info', {
    bun_version: Bun.version,
    pid: process.pid,
    node_env: process.env.NODE_ENV ?? 'development',
    fly_app: process.env.FLY_APP_NAME,
    fly_region: process.env.FLY_REGION,
    fly_machine_id: process.env.FLY_MACHINE_ID,
  });

  const db = await createDb({ logger });

  await ensureGraphileWorkerSetup({ db, logger });

  const worker = await startGraphileWorker({ logger, db });

  onShutdown(logger, async () => {
    await worker.stop();
  });

  logger.info('Worker process ready and waiting for jobs');

  await worker.promise;
}

main().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
