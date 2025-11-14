import type { S3Client } from 'bun';
import type { Logger } from '../../lib/logger';
import type { Db } from '../../sql';
import { isGoogleAuthEnabled } from '../google-oauth-config';
import { generateAuthUrl, getUserInfo, validateCallback } from '../google-oauth-service';
import { getCookie } from '../../lib/http-cookie';
import { getSessionId } from '../../lib/session-id-cookie';
import { GoogleAuthUserService } from './google-auth-http-server-user-service';
import {
  validateOAuthParams,
  validateOAuthState,
  createErrorRedirect,
  createSuccessRedirect,
  createOAuthStateCookie,
} from './google-auth-http-server-validators';

export type GoogleAuthConfig = {
  db: Db;
  s3: S3Client;
  s3Endpoint: string;
  logger: Logger;
};

/**
 * Handle the start of Google OAuth flow
 * Generates authorization URL and redirects user to Google
 */
export async function handleGoogleAuthStart(req: Request, logger: Logger): Promise<Response> {
  // Return 404 if Google Auth is not configured
  if (!isGoogleAuthEnabled()) {
    logger.warn('Google OAuth not configured - returning 404');
    return new Response('Google OAuth not configured', { status: 404 });
  }

  try {
    const { url, state } = generateAuthUrl(req);

    // Set state in cookie for verification in callback
    const response = Response.redirect(url);
    response.headers.set('Set-Cookie', createOAuthStateCookie(state));

    return response;
  } catch (error) {
    logger.error('Error generating Google auth URL:', error as Record<string, unknown>);
    return createErrorRedirect('config_error');
  }
}

/**
 * Handle Google OAuth callback
 * Validates callback, exchanges code for tokens, and creates/links user account
 */
export async function handleGoogleAuthCallback(
  req: Request,
  config: GoogleAuthConfig,
): Promise<Response> {
  const { db, s3, s3Endpoint, logger } = config;

  // Return 404 if Google Auth is not configured
  if (!isGoogleAuthEnabled()) {
    logger.warn('Google OAuth callback accessed but not configured');
    return createErrorRedirect('not_configured');
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  const storedState = getCookie(req, 'oauth_state');

  // Handle OAuth errors from Google
  if (error) {
    logger.warn(`OAuth error from Google: ${error}`);
    return createErrorRedirect(error);
  }

  // Validate required parameters
  const paramsError = validateOAuthParams(code, state);
  if (paramsError) {
    logger.warn('Missing code or state in OAuth callback');
    return createErrorRedirect(paramsError);
  }

  // At this point, code and state are guaranteed to be non-null due to validation
  const validatedCode = code as string;
  const validatedState = state as string;

  // Verify state matches (CSRF protection)
  const stateError = validateOAuthState(validatedState, storedState ?? null);
  if (stateError) {
    logger.warn('OAuth state mismatch - potential CSRF attack');
    return createErrorRedirect(stateError);
  }

  try {
    // Exchange code for tokens
    const accessToken = await validateCallback(validatedCode, validatedState);

    // Get user info from Google
    const googleUser = await getUserInfo(accessToken);

    // Get session ID for user session creation
    const sessionId = getSessionId(req);

    if (!sessionId) {
      throw new Error('No session ID found');
    }

    // Use GoogleAuthUserService to find or create user (handles all cases)
    const userService = new GoogleAuthUserService({ db, s3, s3Endpoint, logger });
    await userService.findOrCreateUser({ googleUser, sessionId });

    // Redirect to app with success
    return createSuccessRedirect();
  } catch (error) {
    logger.error('Google OAuth callback error:', { error: String(error) });
    return createErrorRedirect('oauth_failed');
  }
}
