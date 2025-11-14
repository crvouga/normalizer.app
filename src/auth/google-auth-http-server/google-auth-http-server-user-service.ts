import { and, eq, isNull } from 'drizzle-orm';
import type { S3Client } from 'bun';
import type { Logger } from '../../lib/logger';
import type { Db } from '../../sql';
import type { GoogleUserInfo } from '../google-oauth-service';
import { users, userSessions, type IUser } from '../../db/schema';
import { UserId } from '../../users/user-id';
import { UserSessionId } from '../../users/user-session-id';
import type { SessionId } from '../../lib/session-id';
import { storeProfilePictureFromUrl } from '../../users/user-profile-picture';

export type GoogleAuthUserServiceDeps = {
  db: Db;
  s3: S3Client;
  s3Endpoint: string;
  logger: Logger;
};

export class GoogleAuthUserService {
  private db: Db;
  private s3: S3Client;
  private s3Endpoint: string;
  private logger: Logger;

  constructor({ db, s3, s3Endpoint, logger }: GoogleAuthUserServiceDeps) {
    this.db = db;
    this.s3 = s3;
    this.s3Endpoint = s3Endpoint;
    this.logger = logger;
  }

  /**
   * End any existing anonymous sessions with the same sessionId
   * This ensures that after Google sign-in, queries will find the authenticated session
   */
  private async endAnonymousSessions(
    tx: Parameters<Parameters<Db['transaction']>[0]>[0],
    sessionId: SessionId,
  ): Promise<void> {
    // Find all anonymous user sessions with this sessionId that haven't been ended
    const anonymousSessions = await tx
      .select({
        id: userSessions.id,
      })
      .from(userSessions)
      .innerJoin(users, eq(userSessions.user_id, users.id))
      .where(
        and(
          eq(userSessions.session_id, sessionId),
          eq(users.type, 'anonymous'),
          isNull(userSessions.ended_at),
        ),
      );

    // End all anonymous sessions by updating each one individually
    for (const session of anonymousSessions) {
      await tx
        .update(userSessions)
        .set({ ended_at: new Date() })
        .where(eq(userSessions.id, session.id));
    }
  }

  /**
   * Create a new user session in a transaction
   * Always creates a new session record - this is called after ending any anonymous sessions
   */
  private async createUserSession(
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
  private async linkGoogleAccount(params: {
    existingUser: IUser;
    googleUser: GoogleUserInfo;
    sessionId: SessionId;
  }): Promise<IUser> {
    const { existingUser, googleUser, sessionId } = params;
    // Store profile picture in S3
    const profilePictureUrl = await storeProfilePictureFromUrl({
      s3: this.s3,
      userId: existingUser.id as UserId,
      externalUrl: googleUser.picture,
      s3Endpoint: this.s3Endpoint,
      logger: this.logger,
    });

    // Link Google account and create session in a transaction
    // Always creates a new session record after ending any anonymous sessions
    const updatedUser = await this.db.transaction(async (tx) => {
      // End any existing anonymous sessions with this sessionId
      await this.endAnonymousSessions(tx, sessionId);

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

      // Always create a new session record
      await this.createUserSession(tx, user!.id, sessionId);

      return user!;
    });

    this.logger.info('Linked Google account to existing user', {
      user_id: existingUser.id,
    });

    return updatedUser;
  }

  /**
   * Create a new authenticated user and session
   */
  private async createAuthenticatedUser(params: {
    googleUser: GoogleUserInfo;
    sessionId: SessionId;
  }): Promise<IUser> {
    const { googleUser, sessionId } = params;
    const userId = UserId.generate();

    // Store profile picture in S3
    const profilePictureUrl = await storeProfilePictureFromUrl({
      s3: this.s3,
      userId: userId,
      externalUrl: googleUser.picture,
      s3Endpoint: this.s3Endpoint,
      logger: this.logger,
    });

    // Create user and session in a transaction
    // Always creates a new session record after ending any anonymous sessions
    const newUser = await this.db.transaction(async (tx) => {
      // End any existing anonymous sessions with this sessionId
      await this.endAnonymousSessions(tx, sessionId);

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

      // Always create a new session record
      await this.createUserSession(tx, user!.id, sessionId);

      return user!;
    });

    this.logger.info('Created new authenticated user', { user_id: userId });

    return newUser;
  }

  /**
   * Create session for existing Google user and update profile
   */
  private async createSessionForExistingUser(params: {
    user: IUser;
    googleUser: GoogleUserInfo;
    sessionId: SessionId;
  }): Promise<IUser> {
    const { user, googleUser, sessionId } = params;
    // Update profile picture from Google (in case it changed)
    const profilePictureUrl = await storeProfilePictureFromUrl({
      s3: this.s3,
      userId: user.id as UserId,
      externalUrl: googleUser.picture,
      s3Endpoint: this.s3Endpoint,
      logger: this.logger,
    });

    // Update user info and create session in a transaction
    // Always creates a new session record after ending any anonymous sessions
    const updatedUser = await this.db.transaction(async (tx) => {
      // End any existing anonymous sessions with this sessionId
      await this.endAnonymousSessions(tx, sessionId);

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

      // Always create a new session record
      await this.createUserSession(tx, user.id, sessionId);

      return refreshedUser!;
    });

    this.logger.info('Created session with authenticated user and updated profile', {
      session_id: sessionId,
      user_id: user.id,
    });

    return updatedUser;
  }

  /**
   * Find or create user based on Google account info
   * Always creates a new session record after ending any anonymous sessions.
   * Handles three cases:
   * 1. Existing Google user - create new session and update profile from Google
   * 2. Existing email user - link Google account
   * 3. New user - create authenticated user
   */
  async findOrCreateUser(args: {
    googleUser: GoogleUserInfo;
    sessionId: SessionId;
  }): Promise<IUser> {
    const { googleUser, sessionId } = args;

    this.logger.info('Google OAuth successful', {
      google_id: googleUser.id,
      email: googleUser.email,
    });

    // Find existing user by Google ID
    const existingGoogleUser = await this.db.query.users.findFirst({
      where: eq(users.google_id, googleUser.id),
    });

    if (existingGoogleUser) {
      return this.createSessionForExistingUser({
        user: existingGoogleUser,
        googleUser,
        sessionId,
      });
    }

    // Check if user with same email exists (for account linking)
    const existingEmailUser = await this.db.query.users.findFirst({
      where: eq(users.email, googleUser.email),
    });

    if (existingEmailUser) {
      return this.linkGoogleAccount({
        existingUser: existingEmailUser,
        googleUser,
        sessionId,
      });
    }

    // Create new authenticated user
    return this.createAuthenticatedUser({
      googleUser,
      sessionId,
    });
  }
}
