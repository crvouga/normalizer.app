import { initTRPC } from '@trpc/server';
import type { S3Client } from 'bun';
import type { Logger } from './logger';
import type { Db } from '../sql';
import type { MinioClient } from './minio/minio-client';
import { getSessionId } from './session-id-cookie';
import type { SessionId } from './session-id';
import type { UserId } from '../users/user-id';
import type { UserSessionId } from '../users/user-session-id';
import { and, eq, isNull } from 'drizzle-orm';
import { users, userSessions } from '../db/schema';
import { UserId as UserIdHelper } from '../users/user-id';
import { UserSessionId as UserSessionIdHelper } from '../users/user-session-id';

// Create context type
export type Context = {
  db: Db;
  s3: S3Client;
  s3Endpoint: string;
  minioClient: MinioClient;
  logger: Logger;
  sessionId: SessionId;
  userId: UserId;
  userSessionId: UserSessionId;
};

// Create context function
export const createContext = async (config: {
  db: Db;
  s3: S3Client;
  s3Endpoint: string;
  minioClient: MinioClient;
  logger: Logger;
  req: Request;
}): Promise<Context> => {
  const { db, s3, s3Endpoint, minioClient, logger, req } = config;

  // Get or generate session ID
  const sessionId = getSessionId(req);

  let userId: UserId;
  let userSessionId: UserSessionId;

  // First, try to find an active (non-ended) authenticated session
  const authenticatedSession = await db.query.userSessions.findFirst({
    where: and(eq(userSessions.session_id, sessionId), isNull(userSessions.ended_at)),
    with: {
      user: true,
    },
  });

  if (authenticatedSession && authenticatedSession.user.type === 'authenticated') {
    // Use the authenticated session
    userId = authenticatedSession.user_id as UserId;
    userSessionId = authenticatedSession.id as UserSessionId;
  } else {
    // Fall back to anonymous session or create one
    const anonymousSession = await db.query.userSessions.findFirst({
      where: eq(userSessions.session_id, sessionId),
      with: {
        user: true,
      },
    });

    if (anonymousSession && anonymousSession.user.type === 'anonymous') {
      userId = anonymousSession.user_id as UserId;
      userSessionId = anonymousSession.id as UserSessionId;
    } else {
      // No session exists, create new anonymous user and session
      const result = await db.transaction(async (tx) => {
        const newUserId = UserIdHelper.generate();
        await tx.insert(users).values({
          id: newUserId,
          type: 'anonymous',
          created_at: new Date(),
          updated_at: new Date(),
        });

        const newUserSessionId = UserSessionIdHelper.generate();
        await tx.insert(userSessions).values({
          id: newUserSessionId,
          session_id: sessionId,
          user_id: newUserId,
          started_at: new Date(),
        });

        return { userId: newUserId, userSessionId: newUserSessionId };
      });

      userId = result.userId;
      userSessionId = result.userSessionId;
    }
  }

  return {
    db,
    s3,
    s3Endpoint,
    minioClient,
    logger,
    sessionId,
    userId,
    userSessionId,
  };
};

// Initialize tRPC
const t = initTRPC.context<Context>().create();

// Export procedure creator and router helper
export const procedure = t.procedure;
export const router = t.router;
