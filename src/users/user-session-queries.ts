import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../sql';
import { userSessions } from '../db/schema';
import type { SessionId } from '../lib/session-id';

/**
 * Find the active (non-ended) authenticated user session for a given session ID.
 * Returns the most recently started authenticated session that hasn't ended.
 */
export async function findActiveAuthenticatedSession(db: Db, sessionId: SessionId) {
  return await db.query.userSessions.findFirst({
    where: and(eq(userSessions.session_id, sessionId), isNull(userSessions.ended_at)),
    with: { user: true },
    orderBy: (userSessions, { desc }) => [desc(userSessions.started_at)],
  });
}

/**
 * Find the anonymous user session for a given session ID.
 * Returns the oldest (first created) anonymous session.
 */
export async function findAnonymousSession(db: Db, sessionId: SessionId) {
  return await db.query.userSessions.findFirst({
    where: eq(userSessions.session_id, sessionId),
    with: { user: true },
    orderBy: (userSessions, { asc }) => [asc(userSessions.started_at)],
  });
}

/**
 * Find the current user session for a given session ID.
 * Priority:
 * 1. Active (non-ended) authenticated session
 * 2. Anonymous session
 * Returns null if no session exists.
 */
export async function findCurrentUserSession(db: Db, sessionId: SessionId) {
  // Priority 1: Find active authenticated session
  const authenticatedSession = await findActiveAuthenticatedSession(db, sessionId);
  if (authenticatedSession?.user.type === 'authenticated') {
    return authenticatedSession;
  }

  // Priority 2: Fall back to anonymous session
  const anonymousSession = await findAnonymousSession(db, sessionId);
  if (anonymousSession?.user.type === 'anonymous') {
    return anonymousSession;
  }

  return null;
}
