import { Google } from 'arctic';

// Check if Google OAuth credentials are configured
export const isGoogleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

// Default redirect URI if not specified
const getRedirectUri = () => {
  if (process.env.GOOGLE_REDIRECT_URI) {
    return process.env.GOOGLE_REDIRECT_URI;
  }

  // Default for development
  const port = process.env.PORT || '5000';
  return `http://localhost:${port}/api/auth/google/callback`;
};

// Only initialize Google OAuth client if credentials exist
export const googleOAuthClient = isGoogleAuthEnabled
  ? new Google(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, getRedirectUri())
  : null;

// Helper to ensure OAuth is enabled before using
export function requireGoogleAuth() {
  if (!isGoogleAuthEnabled || !googleOAuthClient) {
    throw new Error('Google OAuth is not configured');
  }
  return googleOAuthClient;
}
