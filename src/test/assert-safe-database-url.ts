const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

export function isLoopbackDatabaseHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

export function assertSafeDatabaseUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid DATABASE_URL: ${url}`);
  }

  if (!isLoopbackDatabaseHost(parsed.hostname)) {
    throw new Error(
      `Refusing database connection to non-loopback host "${parsed.hostname}". ` +
        'Tests must use embedded-postgres on localhost only.',
    );
  }

  const managedUrl = process.env.TEST_MANAGED_DATABASE_URL;
  if (managedUrl && url !== managedUrl) {
    throw new Error(
      'DATABASE_URL does not match TEST_MANAGED_DATABASE_URL. ' +
        'Tests must use the harness-managed database.',
    );
  }
}

/**
 * Strips vault credentials and any pre-existing DATABASE_URL before the test
 * harness starts an isolated embedded-postgres instance.
 */
export function scrubUnsafeTestEnv(): void {
  process.env.NODE_ENV = 'test';
  delete process.env.VAULT_TOKEN;
  delete process.env.DATABASE_URL;
  delete process.env.TEST_MANAGED_DATABASE_URL;
}
