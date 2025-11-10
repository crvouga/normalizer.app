import { generateState, generateCodeVerifier } from 'arctic';
import { requireGoogleAuth } from './google-oauth-config';

// In-memory storage for OAuth state tokens (can be upgraded to Redis for production)
const oauthStates = new Map<
  string,
  {
    codeVerifier: string;
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
 */
export function generateAuthUrl(): { url: string; state: string } {
  const google = requireGoogleAuth();

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  // Store state and verifier for 10 minutes
  oauthStates.set(state, {
    codeVerifier,
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
 */
export async function validateCallback(code: string, state: string): Promise<string> {
  const google = requireGoogleAuth();

  // Retrieve stored state
  const stored = oauthStates.get(state);

  if (!stored) {
    throw new Error('Invalid or expired OAuth state');
  }

  if (stored.expiresAt < Date.now()) {
    oauthStates.delete(state);
    throw new Error('OAuth state expired');
  }

  // Clean up used state
  oauthStates.delete(state);

  // Validate authorization code and get tokens
  const tokens = await google.validateAuthorizationCode(code, stored.codeVerifier);

  // Return access token
  return tokens.accessToken();
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
