import { Google, generateState, generateCodeVerifier } from 'arctic';
import { isGoogleAuthEnabled } from './google-oauth-config';

// In-memory storage for OAuth state tokens (can be upgraded to Redis for production)
// Stores session ID so it can be retrieved in callback without relying on cookies (which use SameSite: Strict)
const oauthStates = new Map<
  string,
  {
    codeVerifier: string;
    redirectUri: string;
    sessionId: string | null; // Session ID stored here to survive OAuth redirect
    expiresAt: number;
  }
>();

// Clean up expired states periodically
function cleanupExpiredStates() {
  const now = Date.now();
  for (const [key, value] of oauthStates.entries()) {
    if (value.expiresAt < now) {
      oauthStates.delete(key);
    }
  }
}

/**
 * Generate Google OAuth authorization URL with PKCE
 * @param sessionId - Optional session ID to store in OAuth state (used when cookies are Strict)
 */
export function generateAuthUrl(
  req: Request,
  sessionId?: string | null,
): { url: string; state: string } {
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
  oauthStates.set(state, {
    codeVerifier,
    redirectUri,
    sessionId: sessionId ?? null,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // Clean up old states
  cleanupExpiredStates();

  // Create authorization URL with scopes
  const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);

  return { url: url.toString(), state };
}

/**
 * Validate OAuth callback and exchange code for tokens
 * @returns Object with access token and session ID from stored state
 */
export async function validateCallback(
  code: string,
  state: string,
): Promise<{ accessToken: string; sessionId: string | null }> {
  if (!isGoogleAuthEnabled()) {
    throw new Error('Google OAuth is not configured');
  }

  // Retrieve stored state
  const stored = oauthStates.get(state);

  if (!stored) {
    throw new Error('Invalid or expired OAuth state');
  }

  if (stored.expiresAt < Date.now()) {
    oauthStates.delete(state);
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
  oauthStates.delete(state);

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
