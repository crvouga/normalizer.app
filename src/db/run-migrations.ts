import { loadVaultSecrets } from '../lib/secrets/load-vault-secrets';
import { normalizeEnvAliases } from '../lib/secrets/normalize-env-aliases';
import { createLogger } from '../lib/logger';
import { runMigrations } from './migrations';

/**
 * Standalone script to run database migrations
 * Usage: bun run src/db/run-migrations.ts
 */
const main = async () => {
  await loadVaultSecrets();
  normalizeEnvAliases();

  const logger = createLogger();

  try {
    await runMigrations(logger);
    logger.info('✅ Migrations completed successfully');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Migration failed:', err as Record<string, unknown>);
    process.exit(1);
  }
};

main();
