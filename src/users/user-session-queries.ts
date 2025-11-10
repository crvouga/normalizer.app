import { and, desc, asc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../sql';
import { userSessions, users } from '../db/schema';
import type { SessionId } from '../lib/session-id';

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
