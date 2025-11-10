import { eq } from 'drizzle-orm';
import type { S3Client } from 'bun';
import type { Logger } from '../../lib/logger';
import type { Db } from '../../sql';
import type { GoogleUserInfo } from '../google-oauth-service';
import { users, userSessions, type IUser } from '../../db/schema';
import { UserId } from '../../users/user-id';
import { UserSessionId } from '../../users/user-session-id';
import type { SessionId } from '../../lib/session-id';
import { storeProfilePictureFromUrl } from '../../users/user-profile-picture';

/**
 * Create a new user session in a transaction
 */
export async function createUserSession(
  tx: Parameters<Parameters<Db['transaction']>[0]>[0],
  userId: string,
  sessionId: SessionId,
): Promise<void> {
  const newUserSessionId = UserSessionId.generate();
  await tx.insert(userSessions).values({
    id: newUserSessionId,
    session_id: sessionId,
    user_id: userId,
    started_at: new Date(),
  });
}

/**
 * Link Google account to existing user and create session
 */
async function linkGoogleAccount(
  db: Db,
  existingUser: IUser,
  googleUser: GoogleUserInfo,
  sessionId: SessionId,
  s3: S3Client,
  s3Endpoint: string,
  logger: Logger,
): Promise<IUser> {
  // Store profile picture in S3
  const profilePictureUrl = await storeProfilePictureFromUrl(
    s3,
    existingUser.id as UserId,
    googleUser.picture,
    s3Endpoint,
    logger,
  );

  // Link Google account and create session in a transaction
  const updatedUser = await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        google_id: googleUser.id,
        type: 'authenticated',
        name: googleUser.name,
        profile_picture: profilePictureUrl,
        updated_at: new Date(),
      })
      .where(eq(users.id, existingUser.id));

    const user = await tx.query.users.findFirst({
      where: eq(users.id, existingUser.id),
    });

    await createUserSession(tx, user!.id, sessionId);

    return user!;
  });

  logger.info('Linked Google account to existing user', {
    user_id: existingUser.id,
  });

  return updatedUser;
}

/**
 * Create a new authenticated user and session
 */
async function createAuthenticatedUser(
  db: Db,
  googleUser: GoogleUserInfo,
  sessionId: SessionId,
  s3: S3Client,
  s3Endpoint: string,
  logger: Logger,
): Promise<IUser> {
  const userId = UserId.generate();

  // Store profile picture in S3
  const profilePictureUrl = await storeProfilePictureFromUrl(
    s3,
    userId,
    googleUser.picture,
    s3Endpoint,
    logger,
  );

  // Create user and session in a transaction
  const newUser = await db.transaction(async (tx) => {
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

    const user = await tx.query.users.findFirst({
      where: eq(users.id, userId),
    });

    await createUserSession(tx, user!.id, sessionId);

    return user!;
  });

  logger.info('Created new authenticated user', { user_id: userId });

  return newUser;
}

/**
 * Create session for existing Google user and update profile
 */
async function createSessionForExistingUser(
  db: Db,
  user: IUser,
  googleUser: GoogleUserInfo,
  sessionId: SessionId,
  s3: S3Client,
  s3Endpoint: string,
  logger: Logger,
): Promise<IUser> {
  // Update profile picture from Google (in case it changed)
  const profilePictureUrl = await storeProfilePictureFromUrl(
    s3,
    user.id as UserId,
    googleUser.picture,
    s3Endpoint,
    logger,
  );

  // Update user info and create session in a transaction
  const updatedUser = await db.transaction(async (tx) => {
    // Update user profile with latest info from Google
    await tx
      .update(users)
      .set({
        name: googleUser.name,
        profile_picture: profilePictureUrl,
        updated_at: new Date(),
      })
      .where(eq(users.id, user.id));

    const refreshedUser = await tx.query.users.findFirst({
      where: eq(users.id, user.id),
    });

    await createUserSession(tx, user.id, sessionId);

    return refreshedUser!;
  });

  logger.info('Created session with authenticated user and updated profile', {
    session_id: sessionId,
    user_id: user.id,
  });

  return updatedUser;
}

/**
 * Find or create user based on Google account info
 * Handles three cases:
 * 1. Existing Google user - create new session and update profile from Google
 * 2. Existing email user - link Google account
 * 3. New user - create authenticated user
 */
export async function findOrCreateUser(
  db: Db,
  googleUser: GoogleUserInfo,
  sessionId: SessionId,
  s3: S3Client,
  s3Endpoint: string,
  logger: Logger,
): Promise<IUser> {
  logger.info('Google OAuth successful', {
    google_id: googleUser.id,
    email: googleUser.email,
  });

  // Find existing user by Google ID
  const existingGoogleUser = await db.query.users.findFirst({
    where: eq(users.google_id, googleUser.id),
  });

  if (existingGoogleUser) {
    return createSessionForExistingUser(
      db,
      existingGoogleUser,
      googleUser,
      sessionId,
      s3,
      s3Endpoint,
      logger,
    );
  }

  // Check if user with same email exists (for account linking)
  const existingEmailUser = await db.query.users.findFirst({
    where: eq(users.email, googleUser.email),
  });

  if (existingEmailUser) {
    return linkGoogleAccount(db, existingEmailUser, googleUser, sessionId, s3, s3Endpoint, logger);
  }

  // Create new authenticated user
  return createAuthenticatedUser(db, googleUser, sessionId, s3, s3Endpoint, logger);
}
