import type { Logger } from '../logger';

export type ShutdownSignal = 'SIGINT' | 'SIGTERM' | 'SIGHUP';

export const onShutdown = (logger: Logger, callback: () => Promise<void>) => {
  const shutdown = async (signal: ShutdownSignal) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    await callback();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGHUP', () => shutdown('SIGHUP'));
  return () => {
    process.off('SIGINT', () => shutdown('SIGINT'));
    process.off('SIGTERM', () => shutdown('SIGTERM'));
    process.off('SIGHUP', () => shutdown('SIGHUP'));
  };
};
