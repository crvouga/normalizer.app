import type { Logger } from '../logger';

export type ShutdownSignal = 'SIGINT' | 'SIGTERM' | 'SIGHUP';

const callbacks: Array<() => Promise<void>> = [];
let isShuttingDown = false;
let handlersRegistered = false;

const shutdown = async (signal: ShutdownSignal, logger: Logger) => {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info(`🛑 Received ${signal}, shutting down gracefully...`);

  for (const callback of callbacks) {
    try {
      await callback();
    } catch (error) {
      logger.error(`❌ Error during shutdown: ${error}`);
    }
  }

  logger.info(`✅ Shutdown complete for ${signal}`);
  process.exit(0);
};

export const onShutdown = (logger: Logger, callback: () => Promise<void>) => {
  callbacks.push(callback);

  if (handlersRegistered) {
    return;
  }
  handlersRegistered = true;

  const handleSignal = (signal: ShutdownSignal) => () => {
    logger.info(`📡 Signal handler triggered: ${signal}`);
    void shutdown(signal, logger);
  };

  process.on('SIGINT', handleSignal('SIGINT'));
  process.on('SIGTERM', handleSignal('SIGTERM'));
  process.on('SIGHUP', handleSignal('SIGHUP'));

  logger.info('🔧 Shutdown handlers registered (SIGINT, SIGTERM, SIGHUP)');
};
