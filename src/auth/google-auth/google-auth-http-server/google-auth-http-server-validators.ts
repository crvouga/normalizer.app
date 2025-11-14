/**
 * Validation utilities for Google OAuth flow
 */

/**
 * Validate OAuth callback parameters
 * Returns error string if invalid, null if valid
 */
export function validateOAuthParams(code: string | null, state: string | null): string | null {
  if (!code || !state) {
    return 'missing_params';
  }
  return null;
}

/**
 * Validate OAuth state matches stored state (CSRF protection)
 * Returns error string if invalid, null if valid
 */
export function validateOAuthState(state: string, storedState: string | null): string | null {
  if (state !== storedState) {
    return 'invalid_state';
  }
  return null;
}

/**
 * Create error redirect response
 */
export function createErrorRedirect(error: string): Response {
  return Response.redirect(`/?auth_error=${error}`);
}

/**
 * Create success redirect response
 */
export function createSuccessRedirect(): Response {
  return Response.redirect('/?auth_success=true');
}

/**
 * Create OAuth state cookie
 */
export function createOAuthStateCookie(state: string): string {
  const isProduction = process.env.NODE_ENV === 'production';
  return `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; ${isProduction ? 'Secure;' : ''}`;
}
