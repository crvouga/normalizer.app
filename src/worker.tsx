import { run } from 'graphile-worker';
import { createLogger } from './lib/logger';
import { checkGraphileWorkerSetup, createTaskList } from './shared/graphile-worker';
import { normalizationTask } from './normalization-session/normalization-task/normalization-task';
import { createDb } from './shared/db';

const main = async () => {
  const logger = createLogger();

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logger.error('DATABASE_URL environment variable is not set');
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Create database connection to check worker setup
  const db = await createDb({ logger });

  // Check Graphile Worker setup
  const graphileWorkerCheck = await checkGraphileWorkerSetup(db, logger);
  if (!graphileWorkerCheck.isSetup) {
    logger.warn(
      'Graphile Worker is not set up. The worker will initialize the schema on startup.',
      graphileWorkerCheck,
    );
  } else {
    logger.info('Graphile Worker is set up correctly');
  }

  logger.info('Starting Graphile Worker...');

  // Define task list with typesafe handlers
  const taskList = createTaskList({
    normalization: normalizationTask,
  });

  // Run the worker
  const runner = await run({
    connectionString: databaseUrl,
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
