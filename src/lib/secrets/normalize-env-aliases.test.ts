import { afterEach, describe, expect, test } from 'bun:test';
import { normalizeEnvAliases } from './normalize-env-aliases';

const GOOGLE_ENV_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'NORMALIZER_APP_GOOGLE_CLIENT_ID',
  'NORMALIZER_APP_GOOGLE_CLIENT_SECRET',
] as const;

const snapshotGoogleEnv = (): Record<string, string | undefined> => {
  return Object.fromEntries(GOOGLE_ENV_KEYS.map((key) => [key, process.env[key]]));
};

const restoreGoogleEnv = (snapshot: Record<string, string | undefined>): void => {
  for (const key of GOOGLE_ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
};

describe('normalizeEnvAliases', () => {
  let envSnapshot: Record<string, string | undefined>;

  afterEach(() => {
    restoreGoogleEnv(envSnapshot);
  });

  test('maps NORMALIZER_APP_GOOGLE_* to GOOGLE_CLIENT_* when targets are unset', () => {
    envSnapshot = snapshotGoogleEnv();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    process.env.NORMALIZER_APP_GOOGLE_CLIENT_ID = 'vault-client-id';
    process.env.NORMALIZER_APP_GOOGLE_CLIENT_SECRET = 'vault-client-secret';

    normalizeEnvAliases();

    const env = snapshotGoogleEnv();
    expect(env.GOOGLE_CLIENT_ID).toBe('vault-client-id');
    expect(env.GOOGLE_CLIENT_SECRET).toBe('vault-client-secret');
  });

  test('does not overwrite pre-set GOOGLE_CLIENT_* values', () => {
    envSnapshot = snapshotGoogleEnv();
    process.env.GOOGLE_CLIENT_ID = 'direct-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'direct-client-secret';
    process.env.NORMALIZER_APP_GOOGLE_CLIENT_ID = 'vault-client-id';
    process.env.NORMALIZER_APP_GOOGLE_CLIENT_SECRET = 'vault-client-secret';

    normalizeEnvAliases();

    expect(process.env.GOOGLE_CLIENT_ID).toBe('direct-client-id');
    expect(process.env.GOOGLE_CLIENT_SECRET).toBe('direct-client-secret');
  });
});
