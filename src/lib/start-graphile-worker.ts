import { run, type Runner } from 'graphile-worker';
import { GRAPHILE_WORKER_SCHEMA_NAME } from '../db/db-schema';
import type { Db } from '../shared/db';
import { createTaskList } from '../shared/graphile-worker';
import type { Logger } from './logger';
import { SecretString } from './secrets/secret-string';
import { normalizationTask } from '../workspace/normalization-task/normalization-task';

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

  const runner = await run({
    connectionString: databaseUrl.DANGEROUSLY_readValue(),
    schema: GRAPHILE_WORKER_SCHEMA_NAME,
    concurrency: 5,
    taskList,
  });

  logger.info('Graphile Worker started');

  void runner.promise.catch((error) => {
    logger.error('Graphile Worker crashed', { error });
    process.exit(1);
  });

  return runner;
}
