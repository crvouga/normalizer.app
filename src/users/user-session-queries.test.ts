import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { createDb, cleanupDb } from '../sql';
import { createLogger } from '../lib/logger';
import { findCurrentUserSession } from './user-session-queries';
import { users, userSessions } from '../db/schema';
import { UserId } from './user-id';
import { UserSessionId } from './user-session-id';
import { SessionId } from '../shared/session-id';
import { eq } from 'drizzle-orm';

describe('User Session Queries - Google Auth Bug', () => {
  const logger = createLogger();
  let db: Awaited<ReturnType<typeof createDb>>;

  beforeAll(async () => {
    db = await createDb({ logger });
  });

  afterAll(async () => {
    await cleanupDb(logger);
  });

  test('should return authenticated session after Google sign-in, not anonymous session', async () => {
    // Generate a single sessionId that will be used for both anonymous and authenticated sessions
    const sessionId = SessionId.generate();

    // Step 1: Simulate initial visit - create anonymous user and session
    // This mimics what happens in createContext when no session exists
    const anonymousUserId = UserId.generate();
    const anonymousUserSessionId = UserSessionId.generate();
    const anonymousSessionStartTime = new Date();

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: anonymousUserId,
        type: 'anonymous',
        created_at: new Date(),
        updated_at: new Date(),
      });

      await tx.insert(userSessions).values({
        id: anonymousUserSessionId,
        session_id: sessionId,
        user_id: anonymousUserId,
        started_at: anonymousSessionStartTime,
      });
    });

    // Step 2: Simulate Google sign-in - create authenticated user and session with same sessionId
    // This mimics what happens in GoogleAuthUserService.findOrCreateUser -> createAuthenticatedUser
    const authenticatedUserId = UserId.generate();
    const authenticatedUserSessionId = UserSessionId.generate();
    // Ensure authenticated session starts after anonymous session
    const authenticatedSessionStartTime = new Date(anonymousSessionStartTime.getTime() + 1000);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: authenticatedUserId,
        type: 'authenticated',
        email: 'test@example.com',
        google_id: 'google-123',
        name: 'Test User',
        profile_picture: null, // Optional field, can be null for test
        created_at: new Date(),
        updated_at: new Date(),
      });

      await tx.insert(userSessions).values({
        id: authenticatedUserSessionId,
        session_id: sessionId, // Same sessionId as anonymous session
        user_id: authenticatedUserId,
        started_at: authenticatedSessionStartTime,
      });
    });

    // Step 3: Query for current session using findCurrentUserSession
    const currentSession = await findCurrentUserSession(db, sessionId);

    // Step 4: Assert - should return authenticated session, not anonymous
    expect(currentSession).not.toBeNull();
    expect(currentSession).toBeDefined();

    if (currentSession) {
      expect(currentSession.user.type).toBe('authenticated');
      expect(currentSession.user.id).toBe(authenticatedUserId);
      expect(currentSession.user.email).toBe('test@example.com');
      expect(currentSession.user.google_id).toBe('google-123');
      expect(currentSession.id).toBe(authenticatedUserSessionId);
      expect(currentSession.user_id).toBe(authenticatedUserId);
      expect(currentSession.session_id).toBe(sessionId);

      // Verify it's NOT the anonymous session
      expect(currentSession.user.type).not.toBe('anonymous');
      expect(currentSession.user.id).not.toBe(anonymousUserId);
      expect(currentSession.id).not.toBe(anonymousUserSessionId);
    }

    // Cleanup test data
    await db.delete(userSessions).where(eq(userSessions.session_id, sessionId));
    await db.delete(users).where(eq(users.id, anonymousUserId));
    await db.delete(users).where(eq(users.id, authenticatedUserId));
  });
});
