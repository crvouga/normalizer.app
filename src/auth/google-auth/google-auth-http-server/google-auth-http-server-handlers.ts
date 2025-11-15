import type { S3Client } from 'bun';
import type { Logger } from '../../../lib/logger';
import type { Db } from '../../../shared/sql';
import { isGoogleAuthEnabled } from '../google-oauth-config';
import { generateAuthUrl, getUserInfo, validateCallback } from '../google-oauth-service';
import { getCookie } from '../../../lib/http-cookie';
import { getSessionId, setSessionCookie } from '../../../shared/session-id-cookie';
import { SessionId } from '../../../shared/session-id';
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
 * Stores session ID in OAuth state so it can be retrieved in callback (since session cookie uses SameSite: Strict)
 */
export async function handleGoogleAuthStart(
  req: Request,
  config: GoogleAuthConfig,
): Promise<Response> {
  const { db, logger } = config;

  // Return 404 if Google Auth is not configured
  if (!isGoogleAuthEnabled()) {
    logger.warn('Google OAuth not configured - returning 404');
    return new Response('Google OAuth not configured', { status: 404 });
  }

  try {
    // Get existing session ID (if any) - this will be stored in OAuth state
    // Since session cookie uses SameSite: Strict, it won't be sent on OAuth redirect
    // So we store it in the OAuth state (server-side) and retrieve it in the callback
    const existingSessionId = getSessionId(req);
    const sessionId = existingSessionId ?? SessionId.generate();

    // Generate auth URL with session ID stored in state
    const { url, state } = await generateAuthUrl(req, db, sessionId);

    // Set state in cookie for verification in callback (CSRF protection)
    const response = Response.redirect(url);
    response.headers.set('Set-Cookie', createOAuthStateCookie(state));

    // If we generated a new session ID, set it in the cookie now
    // This cookie will be available after OAuth callback (same-site navigation)
    if (!existingSessionId) {
      return setSessionCookie(req, response, sessionId);
    }

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
    // Exchange code for tokens and get session ID from OAuth state
    // Session ID is stored in OAuth state because session cookie uses SameSite: Strict
    // This allows us to retrieve it even though the cookie wasn't sent on OAuth redirect
    const { accessToken, sessionId: stateSessionId } = await validateCallback(
      validatedCode,
      validatedState,
      db,
    );

    // Get user info from Google
    const googleUser = await getUserInfo(accessToken);

    // Use session ID from OAuth state, or try to get from cookie, or generate new one
    // Priority: OAuth state > cookie > generate new
    let sessionId: SessionId | null = null;
    if (stateSessionId) {
      sessionId = stateSessionId as SessionId;
    } else {
      // Fallback to cookie (shouldn't happen, but safe fallback)
      sessionId = getSessionId(req);
      if (!sessionId) {
        sessionId = SessionId.generate();
      }
    }

    // Use GoogleAuthUserService to find or create user (handles all cases)
    // This always creates a new session record and ends any anonymous sessions
    const userService = new GoogleAuthUserService({ db, s3, s3Endpoint, logger });
    await userService.findOrCreateUser({ googleUser, sessionId });

    // Redirect to app with success and set session cookie
    // Since this is a same-site navigation, the Strict cookie will be set correctly
    const successResponse = createSuccessRedirect();
    return setSessionCookie(req, successResponse, sessionId);
  } catch (error) {
    logger.error('Google OAuth callback error:', { error: String(error) });
    return createErrorRedirect('oauth_failed');
  }
}
