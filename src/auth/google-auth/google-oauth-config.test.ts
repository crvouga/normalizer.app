import { afterEach, describe, expect, test } from 'bun:test';
import type { Logger } from '../../lib/logger';
import {
  getGoogleOAuthConfigStatus,
  getGoogleOAuthRedirectUri,
  getServerBaseUrl,
  warnGoogleOAuthConfig,
} from './google-oauth-config';

const GOOGLE_ENV_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'SERVER_BASE_URL',
  'PORT',
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

const createCapturingLogger = (): {
  logger: Logger;
  info: Array<{ message: string; meta?: Record<string, unknown> }>;
  warn: Array<{ message: string; meta?: Record<string, unknown> }>;
} => {
  const info: Array<{ message: string; meta?: Record<string, unknown> }> = [];
  const warn: Array<{ message: string; meta?: Record<string, unknown> }> = [];

  const logger: Logger = {
    child: () => logger,
    error: () => {},
    warn: (message, meta) => {
      warn.push({ message, meta });
    },
    info: (message, meta) => {
      info.push({ message, meta });
    },
    debug: () => {},
  };

  return { logger, info, warn };
};

describe('getGoogleOAuthConfigStatus', () => {
  let envSnapshot: Record<string, string | undefined>;

  afterEach(() => {
    restoreGoogleEnv(envSnapshot);
  });

  test('returns enabled when both credentials are set', () => {
    envSnapshot = snapshotGoogleEnv();
    process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';

    expect(getGoogleOAuthConfigStatus()).toBe('enabled');
  });

  test('returns missing when both credentials are absent', () => {
    envSnapshot = snapshotGoogleEnv();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    expect(getGoogleOAuthConfigStatus()).toBe('missing');
  });

  test('returns partial when only one credential is set', () => {
    envSnapshot = snapshotGoogleEnv();
    process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
    delete process.env.GOOGLE_CLIENT_SECRET;

    expect(getGoogleOAuthConfigStatus()).toBe('partial');
  });

  test('returns empty when credentials are blank', () => {
    envSnapshot = snapshotGoogleEnv();
    process.env.GOOGLE_CLIENT_ID = '   ';
    process.env.GOOGLE_CLIENT_SECRET = '';

    expect(getGoogleOAuthConfigStatus()).toBe('empty');
  });
});

describe('getServerBaseUrl', () => {
  let envSnapshot: Record<string, string | undefined>;

  afterEach(() => {
    restoreGoogleEnv(envSnapshot);
  });

  test('defaults to localhost with PORT', () => {
    envSnapshot = snapshotGoogleEnv();
    delete process.env.SERVER_BASE_URL;
    process.env.PORT = '3000';

    expect(getServerBaseUrl()).toBe('http://localhost:3000');
  });

  test('uses SERVER_BASE_URL when set', () => {
    envSnapshot = snapshotGoogleEnv();
    process.env.SERVER_BASE_URL = 'https://normalizer.app';

    expect(getServerBaseUrl()).toBe('https://normalizer.app');
  });

  test('normalizes 0.0.0.0 to localhost', () => {
    envSnapshot = snapshotGoogleEnv();
    process.env.SERVER_BASE_URL = 'http://0.0.0.0:8080';

    expect(getServerBaseUrl()).toBe('http://localhost:8080');
  });
});

describe('getGoogleOAuthRedirectUri', () => {
  let envSnapshot: Record<string, string | undefined>;

  afterEach(() => {
    restoreGoogleEnv(envSnapshot);
  });

  test('appends callback path to server base URL', () => {
    envSnapshot = snapshotGoogleEnv();
    process.env.SERVER_BASE_URL = 'http://localhost:8080';

    expect(getGoogleOAuthRedirectUri()).toBe('http://localhost:8080/api/auth/google/callback');
  });
});

describe('warnGoogleOAuthConfig', () => {
  let envSnapshot: Record<string, string | undefined>;

  afterEach(() => {
    restoreGoogleEnv(envSnapshot);
  });

  test('logs info when OAuth is enabled', () => {
    envSnapshot = snapshotGoogleEnv();
    process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';

    const { logger, info, warn } = createCapturingLogger();
    warnGoogleOAuthConfig(logger);

    expect(info).toHaveLength(1);
    expect(info[0]?.message).toBe('Google OAuth is configured');
    expect(info[0]?.meta?.redirect_uri).toBe('http://localhost:8080/api/auth/google/callback');
    expect(warn).toHaveLength(0);
  });

  test('logs warn when OAuth credentials are missing', () => {
    envSnapshot = snapshotGoogleEnv();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;

    const { logger, info, warn } = createCapturingLogger();
    warnGoogleOAuthConfig(logger);

    expect(warn).toHaveLength(1);
    expect(warn[0]?.message).toBe('Google OAuth is not configured; sign-in is disabled');
    expect(warn[0]?.meta?.vault_keys).toEqual([
      'NORMALIZER_APP_GOOGLE_CLIENT_ID',
      'NORMALIZER_APP_GOOGLE_CLIENT_SECRET',
    ]);
    expect(info).toHaveLength(0);
  });

  test('logs warn when OAuth credentials are partially configured', () => {
    envSnapshot = snapshotGoogleEnv();
    process.env.GOOGLE_CLIENT_ID = 'client-id.apps.googleusercontent.com';
    delete process.env.GOOGLE_CLIENT_SECRET;

    const { logger, warn } = createCapturingLogger();
    warnGoogleOAuthConfig(logger);

    expect(warn).toHaveLength(1);
    expect(warn[0]?.message).toBe('Google OAuth is partially configured; sign-in is disabled');
    expect(warn[0]?.meta?.has_client_id).toBe(true);
    expect(warn[0]?.meta?.has_client_secret).toBe(false);
  });
});
