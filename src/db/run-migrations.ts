import { createLogger } from '../lib/logger';
import { runMigrations } from './migrations';

/**
 * Standalone script to run database migrations
 * Usage: bun run src/db/run-migrations.ts
 */
const main = async () => {
  const logger = createLogger();

  try {
    await runMigrations(logger);
    logger.info('✅ Migrations completed successfully');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Migration failed:', err);
    process.exit(1);
  }
};

main();
