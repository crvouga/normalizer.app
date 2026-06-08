import { getTestDatabaseUrl } from './test-database';
import { DEFAULT_TEST_S3_ENV } from './test-env-defaults';

const PASSTHROUGH_ENV_KEYS = ['PATH', 'HOME', 'USER', 'TMPDIR', 'LANG', 'LC_ALL'] as const;

/**
 * Builds a minimal, safe environment for spawning the app server in tests.
 * Never forwards VAULT_TOKEN or a shell-provided DATABASE_URL.
 */
export function createTestServerEnv(overrides: Record<string, string> = {}): Record<string, string> {
  const env: Record<string, string> = {
    NODE_ENV: 'test',
    DATABASE_URL: getTestDatabaseUrl(),
    ...DEFAULT_TEST_S3_ENV,
    ...overrides,
  };

  for (const key of PASSTHROUGH_ENV_KEYS) {
    const value = process.env[key];
    if (value) {
      env[key] = value;
    }
  }

  return env;
}
