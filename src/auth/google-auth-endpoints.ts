import { eq } from 'drizzle-orm';
import type { Logger } from '../lib/logger';
import type { Db } from '../sql';
import { users, userSessions } from '../db/schema';
import { UserId } from '../users/user-id';
import { isGoogleAuthEnabled } from './google-oauth-config';
import { generateAuthUrl, getUserInfo, validateCallback } from './google-oauth-service';
import { getCookie } from '../lib/http-cookie';
import { getSessionId } from '../lib/session-id-cookie';

/**
 * Create Google OAuth HTTP endpoints
 * These are kept separate from tRPC as Google OAuth requires standard HTTP redirects
 */
export function createGoogleAuthEndpoints(config: { db: Db; logger: Logger }) {
  const { db, logger } = config;

  return {
    '/api/auth/google': {
      GET: async (req: Request) => {
        // Return 404 if Google Auth is not configured
        if (!isGoogleAuthEnabled) {
          logger.warn('Google OAuth not configured - returning 404');
          return new Response('Google OAuth not configured', { status: 404 });
        }

        try {
          const { url, state } = generateAuthUrl();

          // Set state in cookie for verification in callback
          const response = Response.redirect(url);
          response.headers.set(
            'Set-Cookie',
            `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600; ${process.env.NODE_ENV === 'production' ? 'Secure;' : ''}`,
          );

          return response;
        } catch (error) {
          logger.error('Error generating Google auth URL:', error);
          return Response.redirect('/?auth_error=config_error');
        }
      },
    },

    '/api/auth/google/callback': {
      GET: async (req: Request) => {
        // Return 404 if Google Auth is not configured
        if (!isGoogleAuthEnabled) {
          logger.warn('Google OAuth callback accessed but not configured');
          return Response.redirect('/?auth_error=not_configured');
        }

        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');
        const storedState = getCookie(req, 'oauth_state');

        // Handle OAuth errors
        if (error) {
          logger.warn(`OAuth error from Google: ${error}`);
          return Response.redirect(`/?auth_error=${error}`);
        }

        // Validate required parameters
        if (!code || !state) {
          logger.warn('Missing code or state in OAuth callback');
          return Response.redirect('/?auth_error=missing_params');
        }

        // Verify state matches (CSRF protection)
        if (state !== storedState) {
          logger.warn('OAuth state mismatch - potential CSRF attack');
          return Response.redirect('/?auth_error=invalid_state');
        }

        try {
          // Exchange code for tokens
          const accessToken = await validateCallback(code, state);

          // Get user info from Google
          const googleUser = await getUserInfo(accessToken);

          logger.info('Google OAuth successful', {
            google_id: googleUser.id,
            email: googleUser.email,
          });

          // Find existing user by Google ID
          let user = await db.query.users.findFirst({
            where: eq(users.google_id, googleUser.id),
          });

          if (!user) {
            // Check if user with same email exists (for account linking)
            const existingEmailUser = await db.query.users.findFirst({
              where: eq(users.email, googleUser.email),
            });

            if (existingEmailUser) {
              // Link Google account to existing user
              await db
                .update(users)
                .set({
                  google_id: googleUser.id,
                  type: 'authenticated',
                  name: googleUser.name,
                  profile_picture: googleUser.picture,
                  updated_at: new Date(),
                })
                .where(eq(users.id, existingEmailUser.id));

              user = await db.query.users.findFirst({
                where: eq(users.id, existingEmailUser.id),
              });

              logger.info('Linked Google account to existing user', {
                user_id: existingEmailUser.id,
              });
            } else {
              // Create new authenticated user
              const userId = UserId.generate();
              await db.insert(users).values({
                id: userId,
                type: 'authenticated',
                email: googleUser.email,
                google_id: googleUser.id,
                name: googleUser.name,
                profile_picture: googleUser.picture,
                created_at: new Date(),
                updated_at: new Date(),
              });

              user = await db.query.users.findFirst({
                where: eq(users.id, userId),
              });

              logger.info('Created new authenticated user', { user_id: userId });
            }
          }

          // Update current session to point to authenticated user
          const sessionId = getSessionId(req);
          await db
            .update(userSessions)
            .set({ user_id: user!.id, started_at: new Date() })
            .where(eq(userSessions.session_id, sessionId));

          logger.info('Updated session with authenticated user', {
            session_id: sessionId,
            user_id: user!.id,
          });

          // Redirect to app with success
          return Response.redirect('/?auth_success=true');
        } catch (error) {
          logger.error('Google OAuth callback error:', error);
          return Response.redirect('/?auth_error=oauth_failed');
        }
      },
    },
  };
}
