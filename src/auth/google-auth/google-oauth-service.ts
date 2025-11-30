import { Google, generateCodeVerifier, generateState } from 'arctic';
import { z } from 'zod';
import type { Logger } from '../../lib/logger';
import { Ok, Err, isErr, tryCatch, tryCatchAsync, type Result } from '../../lib/result';
import type { Db } from '../../shared/db';
import {
  getGoogleClientId,
  getGoogleClientSecret,
  isGoogleAuthEnabled,
} from './google-oauth-config';
import { GoogleOAuthStateService } from './google-oauth-state-service';

/**
 * Google user info response schema
 */
const googleUserInfoSchema = z
  .object({
    id: z.string().nullish(),
    email: z.string().nullish(),
    verified_email: z.boolean().nullish(),
    name: z.string().nullish(),
    given_name: z.string().nullish(),
    family_name: z.string().nullish(),
    picture: z.string().nullish(),
    locale: z.string().nullish(),
  })
  .passthrough();

/**
 * Google user info response type
 */
export type GoogleUserInfo = z.infer<typeof googleUserInfoSchema>;

/**
 * Google OAuth service that handles OAuth flow with dependency injection.
 * Provides methods for generating auth URLs, validating callbacks, and fetching user info.
 */
export class GoogleOAuthService {
  private stateService: GoogleOAuthStateService;
  private logger: Logger;

  constructor(config: { db: Db; logger: Logger }) {
    this.stateService = new GoogleOAuthStateService({ db: config.db });
    this.logger = config.logger.child(GoogleOAuthService.name);
  }

  /**
   * Generate Google OAuth authorization URL with PKCE
   * @param req - Request object to extract origin for redirect URI
   * @param sessionId - Optional session ID to store in OAuth state (used when cookies are Strict)
   */
  async generateAuthUrl(
    req: Request,
    sessionId?: string | null,
  ): Promise<Result<{ url: string; state: string }, string>> {
    if (!isGoogleAuthEnabled()) {
      this.logger.error('Google OAuth is not configured');
      return Err('Google OAuth is not configured');
    }

    // Extract redirect URI from request origin
    const requestUrl = new URL(req.url);
    const redirectUri = `${requestUrl.origin}/api/auth/google/callback`;

    const googleClientId = getGoogleClientId();
    const googleClientSecret = getGoogleClientSecret();

    if (!googleClientId || !googleClientSecret) {
      this.logger.error('Google OAuth is not configured');
      return Err('Google OAuth is not configured');
    }

    // Create Google client with dynamic redirect URI
    const google = new Google(googleClientId, googleClientSecret, redirectUri);

    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    // Store state, verifier, redirect URI, and session ID
    // Session ID is stored here so it can be retrieved in callback without relying on cookies
    const setStateResult = await this.stateService.setState(state, {
      codeVerifier,
      redirectUri,
      sessionId: sessionId ?? null,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    if (isErr(setStateResult)) {
      return Err(setStateResult.error);
    }

    // Create authorization URL with scopes
    const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);

    return Ok({ url: url.toString(), state });
  }

  /**
   * Validate OAuth callback and exchange code for tokens
   * @param code - Authorization code from OAuth callback
   * @param state - OAuth state parameter
   * @returns Object with access token and session ID from stored state
   */
  async validateCallback(
    code: string,
    state: string,
  ): Promise<Result<{ accessToken: string; sessionId: string | null }, string>> {
    if (!isGoogleAuthEnabled()) {
      this.logger.error('Google OAuth is not configured');
      return Err('Google OAuth is not configured');
    }

    // Retrieve stored state
    const getStateResult = await this.stateService.getState(state);

    if (isErr(getStateResult)) {
      this.logger.warn('Failed to get OAuth state', { state, error: getStateResult.error });
      return Err('Invalid or expired OAuth state');
    }

    const stored = getStateResult.value;

    if (!stored) {
      this.logger.warn('Invalid or expired OAuth state', { state });
      return Err('Invalid or expired OAuth state');
    }

    if (stored.expiresAt < Date.now()) {
      const deleteResult = await this.stateService.deleteState(state);
      if (isErr(deleteResult)) {
        this.logger.warn('Failed to delete expired OAuth state', {
          state,
          error: deleteResult.error,
        });
      }
      this.logger.warn('OAuth state expired', { state, expiresAt: stored.expiresAt });
      return Err('OAuth state expired');
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
    const deleteResult = await this.stateService.deleteState(state);
    if (isErr(deleteResult)) {
      // Log warning but continue - cleanup failure shouldn't block the flow
      this.logger.warn('Failed to delete OAuth state after validation', {
        state,
        error: deleteResult.error,
      });
    }

    // Validate authorization code and get tokens
    const validateResult = await tryCatchAsync(async () => {
      return await google.validateAuthorizationCode(code, stored.codeVerifier);
    });

    if (isErr(validateResult)) {
      const errorMessage =
        validateResult.error instanceof Error
          ? validateResult.error.message
          : String(validateResult.error);
      this.logger.error('Failed to validate authorization code', { error: errorMessage });
      return Err(`Failed to validate authorization code: ${errorMessage}`);
    }

    const tokens = validateResult.value;

    // Return access token and session ID
    return Ok({
      accessToken: tokens.accessToken(),
      sessionId,
    });
  }

  /**
   * Fetch user information from Google using access token
   */
  async getUserInfo(accessToken: string): Promise<Result<GoogleUserInfo, string>> {
    const fetchResult = await tryCatchAsync(async () => {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        this.logger.error('Failed to fetch user info from Google', {
          status: response.status,
          statusText: response.statusText,
        });
        throw new Error(`Failed to fetch user info: ${response.statusText}`);
      }

      return response;
    });

    if (isErr(fetchResult)) {
      const errorMessage =
        fetchResult.error instanceof Error ? fetchResult.error.message : String(fetchResult.error);
      this.logger.error('Failed to fetch user info from Google', { error: errorMessage });
      return Err(errorMessage);
    }

    const response = fetchResult.value;

    const jsonResult = await tryCatchAsync(async () => {
      return await response.json();
    });

    if (isErr(jsonResult)) {
      const errorMessage =
        jsonResult.error instanceof Error ? jsonResult.error.message : String(jsonResult.error);
      this.logger.error('Failed to parse JSON response from Google', { error: errorMessage });
      return Err(`Failed to parse JSON response: ${errorMessage}`);
    }

    const data = jsonResult.value;

    const parseResult = tryCatch(() => {
      return googleUserInfoSchema.parse(data);
    });

    if (isErr(parseResult)) {
      this.logger.error('Failed to parse user info response', {
        error: String(parseResult.error),
      });
      return Err('Invalid user info response format');
    }

    return Ok(parseResult.value);
  }
}
