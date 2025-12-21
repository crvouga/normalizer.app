import { run } from 'graphile-worker';
import { createLogger } from './lib/logger';
import { onShutdown } from './lib/process/on-shutdown';
import { SecretString } from './lib/secrets/secret-string';
import { normalizationTask } from './normalization-session/normalization-task/normalization-task';
import { createDb } from './shared/db';
import { createTaskList } from './shared/graphile-worker';

const main = async () => {
  const logger = createLogger().child('Worker');

  logger.info('Starting Graphile Worker...');

  const databaseUrl = SecretString.assertEnvVar('DATABASE_URL');

  const db = await createDb({ logger });

  const taskList = createTaskList(
    { logger, db },
    {
      normalization: normalizationTask,
    },
  );

  const runner = await run({
    connectionString: databaseUrl.DANGEROUSLY_readValue(),
    concurrency: 5,
    taskList,
  });

  logger.info('Graphile Worker started');

  onShutdown(logger, async () => {
    logger.info('Shutting down worker, resetting ongoing jobs to pending...');

    await runner.stop();
  });

  await runner.promise;
};

main().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
