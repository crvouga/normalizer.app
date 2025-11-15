import { run } from 'graphile-worker';
import { createLogger } from './lib/logger';

const main = async () => {
  const logger = createLogger();

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logger.error('DATABASE_URL environment variable is not set');
    throw new Error('DATABASE_URL environment variable is not set');
  }

  logger.info('Starting Graphile Worker...');

  // Define task list
  const taskList = {
    normalization: async (
      payload: unknown,
      helpers: { logger: { info: (msg: string, meta?: Record<string, unknown>) => void } },
    ) => {
      helpers.logger.info('Running normalization task', { payload });
      // TODO: Implement normalization logic
    },
  };

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
