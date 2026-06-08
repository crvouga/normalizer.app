import { scrubUnsafeTestEnv } from './test/assert-safe-database-url';
import { normalizeEnvAliases } from './lib/secrets/normalize-env-aliases';
import { applyDefaultTestEnv } from './test/test-env-defaults';
import { startTestDatabase } from './test/test-database';

scrubUnsafeTestEnv();
applyDefaultTestEnv();
await startTestDatabase();
normalizeEnvAliases();
