import { getCookie } from '../../../lib/http-cookie';
import type { Logger } from '../../../lib/logger';
import type { ObjectStore } from '../../../lib/object-store/object-store';
import { isErr } from '../../../lib/result';
import type { Db } from '../../../shared/db';
import { SessionId } from '../../../shared/session-id';
import { getSessionId, setSessionCookie } from '../../../shared/session-id-cookie';
import { isGoogleAuthEnabled } from '../google-oauth-config';
import { GoogleOAuthService } from '../google-oauth-service';
import { GoogleAuthUserService } from './google-auth-http-server-user-service';

export type GoogleAuthConfig = {
  db: Db;
  objectStore: ObjectStore;
  logger: Logger;
};

/**
 * Google OAuth HTTP handlers class
 * Handles OAuth flow with dependency injection via constructor
 */
export class GoogleAuthHttpServerHandlers {
  private config: GoogleAuthConfig;

  constructor(config: GoogleAuthConfig) {
    this.config = config;
  }

  /**
   * Handle the start of Google OAuth flow
   * Generates authorization URL and redirects user to Google
   * Stores session ID in OAuth state so it can be retrieved in callback (since session cookie uses SameSite: Strict)
   */
  async handleGoogleAuthStart(req: Request): Promise<Response> {
    const { db, logger } = this.config;

    // Return 404 if Google Auth is not configured
    if (!isGoogleAuthEnabled()) {
      logger.warn('Google OAuth not configured - returning 404');
      return new Response('Google OAuth not configured', { status: 404 });
    }

    // Get existing session ID (if any) - this will be stored in OAuth state
    // Since session cookie uses SameSite: Strict, it won't be sent on OAuth redirect
    // So we store it in the OAuth state (server-side) and retrieve it in the callback
    const existingSessionId = getSessionId(req);
    const sessionId = existingSessionId ?? SessionId.generate();

    // Generate auth URL with session ID stored in state
    const oauthService = new GoogleOAuthService({ db, logger });
    const generateAuthUrlResult = await oauthService.generateAuthUrl(req, sessionId);

    if (isErr(generateAuthUrlResult)) {
      logger.error('Error generating Google auth URL:', { error: generateAuthUrlResult.error });
      return this.createErrorRedirect('config_error');
    }

    const { url, state } = generateAuthUrlResult.value;

    // Set state in cookie for verification in callback (CSRF protection)
    const response = Response.redirect(url);
    response.headers.set('Set-Cookie', this.createOAuthStateCookie(state));

    // If we generated a new session ID, set it in the cookie now
    // This cookie will be available after OAuth callback (same-site navigation)
    if (!existingSessionId) {
      return setSessionCookie(req, response, sessionId);
    }

    return response;
  }

  /**
   * Handle Google OAuth callback
   * Validates callback, exchanges code for tokens, and creates/links user account
   */
  async handleGoogleAuthCallback(req: Request): Promise<Response> {
    const { db, objectStore, logger } = this.config;

    // Return 404 if Google Auth is not configured
    if (!isGoogleAuthEnabled()) {
      logger.warn('Google OAuth callback accessed but not configured');
      return this.createErrorRedirect('not_configured');
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const storedState = getCookie(req, 'oauth_state');

    // Handle OAuth errors from Google
    if (error) {
      logger.warn(`OAuth error from Google: ${error}`);
      return this.createErrorRedirect(error);
    }

    // Validate required parameters
    const paramsError = this.validateOAuthParams(code, state);
    if (paramsError) {
      logger.warn('Missing code or state in OAuth callback');
      return this.createErrorRedirect(paramsError);
    }

    // At this point, code and state are guaranteed to be non-null due to validation
    const validatedCode = code as string;
    const validatedState = state as string;

    // Verify state matches (CSRF protection)
    const stateError = this.validateOAuthState(validatedState, storedState ?? null);
    if (stateError) {
      logger.warn('OAuth state mismatch - potential CSRF attack');
      return this.createErrorRedirect(stateError);
    }

    // Exchange code for tokens and get session ID from OAuth state
    // Session ID is stored in OAuth state because session cookie uses SameSite: Strict
    // This allows us to retrieve it even though the cookie wasn't sent on OAuth redirect
    const oauthService = new GoogleOAuthService({ db, logger });
    const validateCallbackResult = await oauthService.validateCallback(
      validatedCode,
      validatedState,
    );

    if (isErr(validateCallbackResult)) {
      logger.error('Google OAuth callback error:', { error: validateCallbackResult.error });
      return this.createErrorRedirect('oauth_failed');
    }

    const { accessToken, sessionId: stateSessionId } = validateCallbackResult.value;

    // Get user info from Google
    const getUserInfoResult = await oauthService.getUserInfo(accessToken);

    if (isErr(getUserInfoResult)) {
      logger.error('Google OAuth callback error:', { error: getUserInfoResult.error });
      return this.createErrorRedirect('oauth_failed');
    }

    const googleUser = getUserInfoResult.value;

    // Use session ID from OAuth state, or try to get from cookie, or generate new one
    // Priority: OAuth state > cookie > generate new
    const sessionId = this.resolveSessionId(stateSessionId, req);

    // Use GoogleAuthUserService to find or create user (handles all cases)
    // This always creates a new session record and ends any anonymous sessions
    const userService = new GoogleAuthUserService({ db, objectStore, logger });
    await userService.findOrCreateUser({ googleUser, sessionId });

    // Redirect to app with success and set session cookie
    // Since this is a same-site navigation, the Strict cookie will be set correctly
    const successResponse = this.createSuccessRedirect();
    return setSessionCookie(req, successResponse, sessionId);
  }

  /**
   * Resolve session ID with priority: OAuth state > cookie > generate new
   */
  private resolveSessionId(stateSessionId: string | null, req: Request): SessionId {
    if (stateSessionId) {
      return SessionId.fromString(stateSessionId);
    }

    // Fallback to cookie (shouldn't happen, but safe fallback)
    const cookieSessionId = getSessionId(req);

    if (cookieSessionId) {
      return cookieSessionId;
    }

    return SessionId.generate();
  }

  /**
   * Validation utilities for Google OAuth flow
   */

  /**
   * Validate OAuth callback parameters
   * Returns error string if invalid, null if valid
   */
  private validateOAuthParams(code: string | null, state: string | null): string | null {
    if (!code || !state) {
      return 'missing_params';
    }
    return null;
  }

  /**
   * Validate OAuth state matches stored state (CSRF protection)
   * Returns error string if invalid, null if valid
   */
  private validateOAuthState(state: string, storedState: string | null): string | null {
    if (state !== storedState) {
      return 'invalid_state';
    }
    return null;
  }

  /**
   * Create error redirect response
   */
  private createErrorRedirect(error: string): Response {
    return Response.redirect(`/?auth_error=${error}`);
  }

  /**
   * Create success redirect response
   */
  private createSuccessRedirect(): Response {
    return Response.redirect('/?auth_success=true');
  }

  /**
   * Create OAuth state cookie
   */
  private createOAuthStateCookie(state: string): string {
    const isProduction = process.env.NODE_ENV === 'production';
    return `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; ${isProduction ? 'Secure;' : ''}`;
  }
}
