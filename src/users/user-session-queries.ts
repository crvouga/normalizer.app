import { and, desc, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../shared/db';
import { userSessions, users } from '../db/schema';
import type { SessionId } from '../shared/session-id';

export async function findActiveAuthenticatedSession(db: Db, sessionId: SessionId) {
  const [session] = await db
    .select({
      id: userSessions.id,
      session_id: userSessions.session_id,
      user_id: userSessions.user_id,
      started_at: userSessions.started_at,
      ended_at: userSessions.ended_at,
      user: users,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.user_id, users.id))
    .where(
      and(
        eq(userSessions.session_id, sessionId),
        eq(users.type, 'authenticated'),
        isNull(userSessions.ended_at),
      ),
    )
    .orderBy(desc(userSessions.started_at))
    .limit(1);

  /**
   SELECT
     user_sessions.id,
     user_sessions.session_id,
     user_sessions.user_id,
     user_sessions.started_at,
     user_sessions.ended_at,
     users.*
   FROM user_sessions
   INNER JOIN users ON user_sessions.user_id = users.id
   WHERE
     user_sessions.session_id = $1
     AND users.type = 'authenticated'
     AND user_sessions.ended_at IS NULL
   ORDER BY user_sessions.started_at DESC
   LIMIT 1;
   */

  return session;
}

export async function findAnonymousSession(db: Db, sessionId: SessionId) {
  const [session] = await db
    .select({
      id: userSessions.id,
      session_id: userSessions.session_id,
      user_id: userSessions.user_id,
      started_at: userSessions.started_at,
      ended_at: userSessions.ended_at,
      user: users,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.user_id, users.id))
    .where(and(eq(userSessions.session_id, sessionId), eq(users.type, 'anonymous')))
    .orderBy(asc(userSessions.started_at))
    .limit(1);

  return session;
}

export async function findCurrentUserSession(db: Db, sessionId: SessionId) {
  return (
    (await findActiveAuthenticatedSession(db, sessionId)) ||
    (await findAnonymousSession(db, sessionId)) ||
    null
  );
}
