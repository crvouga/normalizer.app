import { run, type Runner } from 'graphile-worker';
import { GRAPHILE_WORKER_SCHEMA_NAME } from '../db/db-schema';
import type { Db } from '../shared/db';
import { createTaskList } from '../shared/graphile-worker';
import type { Logger } from './logger';
import { SecretString } from './secrets/secret-string';
import { normalizationTask } from '../workspace/normalization-task/normalization-task';

const DEFAULT_WORKER_CONCURRENCY = 5;

/**
 * Resolve worker concurrency from WORKER_CONCURRENCY. Each concurrent
 * normalization job spins up its own PGlite (WASM Postgres) instance, so this
 * should be tuned to the worker machine's memory/CPU to avoid OOM/event-loop
 * starvation.
 */
function resolveConcurrency(): number {
  const raw = process.env.WORKER_CONCURRENCY;
  if (!raw) {
    return DEFAULT_WORKER_CONCURRENCY;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_WORKER_CONCURRENCY;
  }
  return parsed;
}

export async function startGraphileWorker({
  logger,
  db,
}: {
  logger: Logger;
  db: Db;
}): Promise<Runner> {
  const databaseUrl = SecretString.assertEnvVar('DATABASE_URL');

  const taskList = createTaskList(
    { logger, db },
    {
      normalization: normalizationTask,
    },
  );

  const concurrency = resolveConcurrency();

  const runner = await run({
    connectionString: databaseUrl.DANGEROUSLY_readValue(),
    schema: GRAPHILE_WORKER_SCHEMA_NAME,
    concurrency,
    taskList,
  });

  logger.info('Graphile Worker started', { concurrency });

  void runner.promise.catch((error) => {
    logger.error('Graphile Worker crashed', { error });
    process.exit(1);
  });

  return runner;
}
