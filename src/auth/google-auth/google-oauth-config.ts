import type { Logger } from '../../lib/logger';

export type GoogleOAuthConfigStatus = 'enabled' | 'missing' | 'partial' | 'empty';

const VAULT_GOOGLE_CLIENT_ID_KEY = 'NORMALIZER_APP_GOOGLE_CLIENT_ID';
const VAULT_GOOGLE_CLIENT_SECRET_KEY = 'NORMALIZER_APP_GOOGLE_CLIENT_SECRET';

const resolveEnvValue = (name: string): string | null => {
  const value = process.env[name];
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
};

export function getGoogleClientId(): string | null {
  const value = resolveEnvValue('GOOGLE_CLIENT_ID');
  return value === '' ? null : value;
}

export function getGoogleClientSecret(): string | null {
  const value = resolveEnvValue('GOOGLE_CLIENT_SECRET');
  return value === '' ? null : value;
}

export function isGoogleAuthEnabled(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}

const GOOGLE_OAUTH_CALLBACK_PATH = '/api/auth/google/callback';

/**
 * Base URL for OAuth redirects. Uses SERVER_BASE_URL when set, otherwise
 * http://localhost:{PORT}. Normalizes 0.0.0.0 to localhost — Google OAuth
 * only accepts localhost or 127.0.0.1 as loopback redirect hosts.
 */
export function getServerBaseUrl(): string {
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  const raw = process.env.SERVER_BASE_URL?.trim() || `http://localhost:${port}`;

  try {
    const url = new URL(raw);
    if (url.hostname === '0.0.0.0') {
      url.hostname = 'localhost';
    }
    return url.origin;
  } catch {
    return raw.replace(/\/$/, '');
  }
}

export function getGoogleOAuthRedirectUri(): string {
  return `${getServerBaseUrl()}${GOOGLE_OAUTH_CALLBACK_PATH}`;
}

export function getGoogleOAuthConfigStatus(): GoogleOAuthConfigStatus {
  const clientId = resolveEnvValue('GOOGLE_CLIENT_ID');
  const clientSecret = resolveEnvValue('GOOGLE_CLIENT_SECRET');

  if (clientId === null && clientSecret === null) {
    return 'missing';
  }
  if (clientId === '' || clientSecret === '') {
    return 'empty';
  }
  if (clientId === null || clientSecret === null) {
    return 'partial';
  }
  return 'enabled';
}

export function warnGoogleOAuthConfig(logger: Logger): void {
  const status = getGoogleOAuthConfigStatus();

  switch (status) {
    case 'enabled':
      logger.info('Google OAuth is configured', {
        redirect_uri: getGoogleOAuthRedirectUri(),
      });
      return;
    case 'missing':
      logger.warn('Google OAuth is not configured; sign-in is disabled', {
        vault_keys: [VAULT_GOOGLE_CLIENT_ID_KEY, VAULT_GOOGLE_CLIENT_SECRET_KEY],
        vault_paths: ['secret/personal/dev', 'secret/personal/prd'],
      });
      return;
    case 'partial':
      logger.warn('Google OAuth is partially configured; sign-in is disabled', {
        has_client_id: getGoogleClientId() !== null,
        has_client_secret: getGoogleClientSecret() !== null,
        vault_keys: [VAULT_GOOGLE_CLIENT_ID_KEY, VAULT_GOOGLE_CLIENT_SECRET_KEY],
        vault_paths: ['secret/personal/dev', 'secret/personal/prd'],
      });
      return;
    case 'empty':
      logger.warn('Google OAuth credentials are empty; sign-in is disabled', {
        vault_keys: [VAULT_GOOGLE_CLIENT_ID_KEY, VAULT_GOOGLE_CLIENT_SECRET_KEY],
        vault_paths: ['secret/personal/dev', 'secret/personal/prd'],
      });
      return;
  }
}
