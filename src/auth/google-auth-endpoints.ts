import { eq } from 'drizzle-orm';
import type { S3Client } from 'bun';
import type { Logger } from '../lib/logger';
import type { Db } from '../sql';
import { users, userSessions } from '../db/schema';
import { UserId } from '../users/user-id';
import { UserSessionId } from '../users/user-session-id';
import { isGoogleAuthEnabled } from './google-oauth-config';
import { generateAuthUrl, getUserInfo, validateCallback } from './google-oauth-service';
import { getCookie } from '../lib/http-cookie';
import { getSessionId } from '../lib/session-id-cookie';
import { storeProfilePictureFromUrl } from '../users/user-profile-picture';

/**
 * Create Google OAuth HTTP endpoints
 * These are kept separate from tRPC as Google OAuth requires standard HTTP redirects
 */
export function createGoogleAuthEndpoints(config: {
  db: Db;
  s3: S3Client;
  s3Endpoint: string;
  logger: Logger;
}) {
  const { db, s3, s3Endpoint, logger } = config;

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

          // Get session ID for use in transaction
          const sessionId = getSessionId(req);

          if (!user) {
            // Check if user with same email exists (for account linking)
            const existingEmailUser = await db.query.users.findFirst({
              where: eq(users.email, googleUser.email),
            });

            if (existingEmailUser) {
              // Store profile picture in S3
              const profilePictureUrl = await storeProfilePictureFromUrl(
                s3,
                existingEmailUser.id as UserId,
                googleUser.picture,
                s3Endpoint,
                logger,
              );

              // Link Google account to existing user and create new session in a transaction
              user = await db.transaction(async (tx) => {
                await tx
                  .update(users)
                  .set({
                    google_id: googleUser.id,
                    type: 'authenticated',
                    name: googleUser.name,
                    profile_picture: profilePictureUrl,
                    updated_at: new Date(),
                  })
                  .where(eq(users.id, existingEmailUser.id));

                const updatedUser = await tx.query.users.findFirst({
                  where: eq(users.id, existingEmailUser.id),
                });

                // Create new session with authenticated user (keeps anonymous session intact)
                const newUserSessionId = UserSessionId.generate();
                await tx.insert(userSessions).values({
                  id: newUserSessionId,
                  session_id: sessionId,
                  user_id: updatedUser!.id,
                  started_at: new Date(),
                });

                return updatedUser;
              });

              logger.info('Linked Google account to existing user', {
                user_id: existingEmailUser.id,
              });
            } else {
              // Create new authenticated user and new session in a transaction
              const userId = UserId.generate();

              // Store profile picture in S3
              const profilePictureUrl = await storeProfilePictureFromUrl(
                s3,
                userId,
                googleUser.picture,
                s3Endpoint,
                logger,
              );

              user = await db.transaction(async (tx) => {
                await tx.insert(users).values({
                  id: userId,
                  type: 'authenticated',
                  email: googleUser.email,
                  google_id: googleUser.id,
                  name: googleUser.name,
                  profile_picture: profilePictureUrl,
                  created_at: new Date(),
                  updated_at: new Date(),
                });

                const newUser = await tx.query.users.findFirst({
                  where: eq(users.id, userId),
                });

                // Create new session with authenticated user (keeps anonymous session intact)
                const newUserSessionId = UserSessionId.generate();
                await tx.insert(userSessions).values({
                  id: newUserSessionId,
                  session_id: sessionId,
                  user_id: newUser!.id,
                  started_at: new Date(),
                });

                return newUser;
              });

              logger.info('Created new authenticated user', { user_id: userId });
            }
          } else {
            // Create new session for existing Google user
            await db.transaction(async (tx) => {
              const newUserSessionId = UserSessionId.generate();
              await tx.insert(userSessions).values({
                id: newUserSessionId,
                session_id: sessionId,
                user_id: user!.id,
                started_at: new Date(),
              });
            });
          }

          logger.info('Created session with authenticated user', {
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
