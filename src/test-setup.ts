import { scrubUnsafeTestEnv } from './test/assert-safe-database-url';
import { normalizeEnvAliases } from './lib/secrets/normalize-env-aliases';
import { applyDefaultTestEnv } from './test/test-env-defaults';
import { connectToTestDatabase } from './test/test-database';
import { connectToTestMinio } from './test/test-minio';

scrubUnsafeTestEnv();
applyDefaultTestEnv();
await connectToTestDatabase();
await connectToTestMinio();
normalizeEnvAliases();
