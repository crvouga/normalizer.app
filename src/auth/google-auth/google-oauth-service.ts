import { z } from 'zod';
import { Google, generateState, generateCodeVerifier } from 'arctic';
import type { Db } from '../../shared/sql';
import { PostgresKeyValueStore } from '../../lib/key-value-store-postgres';
import { TypedKeyValueStore } from '../../lib/typed-key-value-store';
import { isOk } from '../../lib/result';
import { isGoogleAuthEnabled } from './google-oauth-config';

// OAuth state schema for type-safe storage
const oauthStateSchema = z.object({
  codeVerifier: z.string(),
  redirectUri: z.string(),
  sessionId: z.string().nullable(),
  expiresAt: z.number(),
});

type OAuthState = z.infer<typeof oauthStateSchema>;

/**
 * Google OAuth service that uses TypedKeyValueStore for persistent state storage.
 * Stores OAuth state tokens in the database instead of in-memory Map.
 * Session ID is stored in state so it can be retrieved in callback without relying on cookies (which use SameSite: Strict).
 */
export class GoogleOAuthService {
  private stateStore: TypedKeyValueStore<OAuthState>;
  private keyPrefix = 'oauth_state:';

  constructor(db: Db) {
    const baseStore = new PostgresKeyValueStore(db);
    this.stateStore = new TypedKeyValueStore(baseStore, oauthStateSchema);
  }

  /**
   * Get the full key for an OAuth state
   */
  private getStateKey(state: string): string {
    return `${this.keyPrefix}${state}`;
  }

  /**
   * Store OAuth state
   */
  async setState(state: string, value: OAuthState): Promise<void> {
    const result = await this.stateStore.set({ [this.getStateKey(state)]: value });
    if (!isOk(result)) {
      throw new Error(`Failed to store OAuth state: ${result.error}`);
    }
  }

  /**
   * Get OAuth state
   */
  async getState(state: string): Promise<OAuthState | null> {
    const result = await this.stateStore.get([this.getStateKey(state)]);
    if (!isOk(result)) {
      throw new Error(`Failed to get OAuth state: ${result.error}`);
    }
    const value = result.value[this.getStateKey(state)];
    return value ?? null;
  }

  /**
   * Delete OAuth state
   */
  async deleteState(state: string): Promise<void> {
    const result = await this.stateStore.delete([this.getStateKey(state)]);
    if (!isOk(result)) {
      throw new Error(`Failed to delete OAuth state: ${result.error}`);
    }
  }
}

/**
 * Generate Google OAuth authorization URL with PKCE
 * @param req - Request object to extract origin for redirect URI
 * @param db - Database connection for storing OAuth state
 * @param sessionId - Optional session ID to store in OAuth state (used when cookies are Strict)
 */
export async function generateAuthUrl(
  req: Request,
  db: Db,
  sessionId?: string | null,
): Promise<{ url: string; state: string }> {
  if (!isGoogleAuthEnabled()) {
    throw new Error('Google OAuth is not configured');
  }

  // Extract redirect URI from request origin
  const requestUrl = new URL(req.url);
  const redirectUri = `${requestUrl.origin}/api/auth/google/callback`;

  // Create Google client with dynamic redirect URI
  const google = new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    redirectUri,
  );

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Store state, verifier, redirect URI, and session ID
  // Session ID is stored here so it can be retrieved in callback without relying on cookies
  const service = new GoogleOAuthService(db);
  await service.setState(state, {
    codeVerifier,
    redirectUri,
    sessionId: sessionId ?? null,
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  // Create authorization URL with scopes
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);

  return { url: url.toString(), state };
}

/**
 * Validate OAuth callback and exchange code for tokens
 * @param code - Authorization code from OAuth callback
 * @param state - OAuth state parameter
 * @param db - Database connection for retrieving OAuth state
 * @returns Object with access token and session ID from stored state
 */
export async function validateCallback(
  code: string,
  state: string,
  db: Db,
): Promise<{ accessToken: string; sessionId: string | null }> {
  if (!isGoogleAuthEnabled()) {
    throw new Error('Google OAuth is not configured');
  }

  // Retrieve stored state
  const service = new GoogleOAuthService(db);
  const stored = await service.getState(state);

  if (!stored) {
    throw new Error('Invalid or expired OAuth state');
  }

  if (stored.expiresAt < Date.now()) {
    await service.deleteState(state);
    throw new Error('OAuth state expired');
  }

  // Create Google client with the SAME redirect URI used during authorization
  const google = new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    stored.redirectUri,
  );

  // Extract session ID before cleaning up state
  const sessionId = stored.sessionId;

  // Clean up used state
  await service.deleteState(state);

  // Validate authorization code and get tokens
  const tokens = await google.validateAuthorizationCode(code, stored.codeVerifier);

  // Return access token and session ID
  return {
    accessToken: tokens.accessToken(),
    sessionId,
  };
}

/**
 * Fetch user information from Google using access token
 */
export async function getUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user info: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Google user info response type
 */
export type GoogleUserInfo = {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: string;
};
