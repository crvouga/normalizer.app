import type { Logger } from '../lib/logger';

/**
 * Runs drizzle-kit migrations on startup
 */
export async function runMigrations(logger: Logger): Promise<void> {
  try {
    logger.info('Running database migrations...');
    // Use Bun to spawn drizzle-kit migrate
    const proc = Bun.spawn({
      cmd: ['bun', 'x', 'drizzle-kit', 'migrate'],
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // Forward stdout and stderr to logs
    for await (const chunk of proc.stdout) {
      logger.info(`[drizzle-kit] ${Buffer.from(chunk).toString('utf-8').trim()}`);
    }
    for await (const chunk of proc.stderr) {
      logger.error(`[drizzle-kit] ${Buffer.from(chunk).toString('utf-8').trim()}`);
    }

    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      throw new Error(`drizzle-kit migrate failed with code ${exitCode}`);
    }

    logger.info('Database migrations complete.');
  } catch (err) {
    logger.error('Failed to run database migrations:', err);
    process.exit(1);
  }
}
