import type { Logger } from '../../lib/logger';
import { isLoopbackHost } from '../../lib/object-store/loopback-host';

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

function normalizeOrigin(raw: string): string {
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

function getRequestOrigin(req: Request): string | null {
  const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwardedHost ?? req.headers.get('host')?.trim();

  if (host) {
    const proto =
      forwardedProto ??
      (process.env.NODE_ENV === 'production' && !isLoopbackHost(host) ? 'https' : 'http');
    return normalizeOrigin(`${proto}://${host}`);
  }

  try {
    const url = new URL(req.url);
    if (!isLoopbackHost(url.hostname)) {
      return url.origin;
    }
  } catch {
    // ignore invalid request URL
  }

  return null;
}

/**
 * Base URL for OAuth redirects. Prefers SERVER_BASE_URL when set; otherwise derives
 * the public origin from proxy headers (Fly sets X-Forwarded-Proto/Host). Falls back
 * to http://localhost:{PORT} for local dev only.
 */
export function getServerBaseUrl(req?: Request): string {
  const fromEnv = process.env.SERVER_BASE_URL?.trim();
  if (fromEnv) {
    return normalizeOrigin(fromEnv);
  }

  if (req) {
    const fromRequest = getRequestOrigin(req);
    if (fromRequest) {
      return fromRequest;
    }
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
  return `http://localhost:${port}`;
}

export function getGoogleOAuthRedirectUri(req?: Request): string {
  return `${getServerBaseUrl(req)}${GOOGLE_OAUTH_CALLBACK_PATH}`;
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
