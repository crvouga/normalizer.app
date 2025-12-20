import { run } from 'graphile-worker';
import { createLogger } from './lib/logger';
import { checkGraphileWorkerSetup, createTaskList } from './shared/graphile-worker';
import { normalizationTask } from './normalization-session/normalization-task/normalization-task';
import { createDb } from './shared/db';
import { SecretString } from './lib/secrets/secret-string';

// Singleton database connection for the worker
let workerDb: Awaited<ReturnType<typeof createDb>> | null = null;

const main = async () => {
  const rootLogger = createLogger();
  const logger = rootLogger.child('Worker');

  const databaseUrl = SecretString.fromEnvVar('DATABASE_URL');
  if (!databaseUrl) throw new Error('DATABASE_URL is not set');

  // Create singleton database connection
  if (!workerDb) {
    workerDb = await createDb({ logger });
    logger.info('Created singleton database connection for worker');
  }

  // Check Graphile Worker setup
  const graphileWorkerCheck = await checkGraphileWorkerSetup(workerDb, logger);
  if (!graphileWorkerCheck.isSetup) {
    logger.warn(
      'Graphile Worker is not set up. The worker will initialize the schema on startup.',
      graphileWorkerCheck,
    );
  } else {
    logger.info('Graphile Worker is set up correctly');
  }

  logger.info('Starting Graphile Worker...');

  // Define task list with type-safe handlers
  const taskList = createTaskList(
    {
      logger,
      db: workerDb,
    },
    {
      normalization: normalizationTask,
    },
  );

  // Run the worker
  const runner = await run({
    connectionString: databaseUrl.DANGEROUSLY_readValue(),
    concurrency: 5,
    taskList,
  });

  logger.info('Graphile Worker started');

  // Setup graceful shutdown handlers
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await runner.stop();
    process.exit(0);
  };

  ['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => process.on(signal, () => shutdown(signal)));

  // Wait for the worker to finish
  await runner.promise;
};

main().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
