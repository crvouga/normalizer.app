const DEFAULT_VAULT_ADDR = 'https://vault.chrisvouga.dev';
const DEFAULT_VAULT_MOUNT = 'secret';
const DEFAULT_VAULT_PROJECT = 'personal';
const DEFAULT_VAULT_CONFIG = 'prd';

type VaultKvResponse = {
  data?: {
    data?: Record<string, string>;
  };
};

/**
 * Fetches secrets from the self-hosted OpenBao/Vault KV v2 API and injects them
 * into process.env (only when not already set).
 *
 * No-op when VAULT_TOKEN is absent — local dev uses `vault run` instead.
 */
export async function loadVaultSecrets(): Promise<void> {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const token = process.env.VAULT_TOKEN;
  if (!token) {
    return;
  }

  const addr = (process.env.VAULT_ADDR ?? DEFAULT_VAULT_ADDR).replace(/\/$/, '');
  const mount = process.env.VAULT_MOUNT ?? DEFAULT_VAULT_MOUNT;
  const project = process.env.VAULT_PROJECT ?? DEFAULT_VAULT_PROJECT;
  const config = process.env.VAULT_CONFIG ?? DEFAULT_VAULT_CONFIG;

  const url = `${addr}/v1/${mount}/data/${project}/${config}`;

  const response = await fetch(url, {
    headers: {
      'X-Vault-Token': token,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Vault secret fetch failed: HTTP ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as VaultKvResponse;
  const fields = body.data?.data;

  if (!fields || typeof fields !== 'object') {
    throw new Error('Vault secret fetch returned no data fields');
  }

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string' && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
