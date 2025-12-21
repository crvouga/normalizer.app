import type { Logger } from '../logger';

export type ShutdownSignal = 'SIGINT' | 'SIGTERM' | 'SIGHUP' | 'beforeExit' | 'exit';

export const onShutdown = (logger: Logger, callback: () => Promise<void>) => {
  let isShuttingDown = false;

  const shutdown = async (signal: ShutdownSignal) => {
    // Prevent multiple shutdown attempts
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    logger.info(`🛑 Received ${signal}, shutting down gracefully...`);

    try {
      await callback();
      logger.info(`✅ Shutdown complete for ${signal}`);
    } catch (error) {
      logger.error(`❌ Error during shutdown: ${error}`);
    }

    process.exit(0);
  };

  const handleSignal = (signal: ShutdownSignal) => () => {
    logger.info(`📡 Signal handler triggered: ${signal}`);
    shutdown(signal);
  };

  const sigintHandler = handleSignal('SIGINT');
  const sigtermHandler = handleSignal('SIGTERM');
  const sighupHandler = handleSignal('SIGHUP');

  // Handle standard Unix signals
  process.on('SIGINT', sigintHandler);
  process.on('SIGTERM', sigtermHandler);
  process.on('SIGHUP', sighupHandler);

  logger.info('🔧 Shutdown handlers registered (SIGINT, SIGTERM, SIGHUP, beforeExit)');

  // Handle beforeExit - this fires when event loop is empty
  // This can catch some cases where the process is exiting without signals
  const beforeExitHandler = () => {
    if (!isShuttingDown) {
      logger.info('⚠️  Process is exiting (beforeExit), attempting graceful shutdown...');
      // Note: beforeExit allows async operations, but we need to schedule new work
      shutdown('beforeExit').catch((err) => {
        logger.error(`Failed to shutdown gracefully: ${err}`);
      });
    }
  };
  process.on('beforeExit', beforeExitHandler);

  // Also try to catch the exit event (though this won't allow async operations)
  const exitHandler = () => {
    if (!isShuttingDown) {
      logger.info('⚠️  Process is exiting (exit event) - too late for async cleanup');
    }
  };
  process.on('exit', exitHandler);

  return () => {
    process.off('SIGINT', sigintHandler);
    process.off('SIGTERM', sigtermHandler);
    process.off('SIGHUP', sighupHandler);
    process.off('beforeExit', beforeExitHandler);
    process.off('exit', exitHandler);
  };
};
