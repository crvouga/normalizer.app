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

// Helper to return context
function buildContext({
  db,
  s3,
  s3Endpoint,
  minioClient,
  logger,
  sessionId,
  userId,
  userSessionId,
}: {
  db: Db;
  s3: S3Client;
  s3Endpoint: string;
  minioClient: MinioClient;
  logger: Logger;
  sessionId: SessionId;
  userId: UserId;
  userSessionId: UserSessionId;
}): Context {
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
}

// Create context function: find first user session where matches session id AND authenticated user else anonymous session
export const createContext = async (config: {
  db: Db;
  s3: S3Client;
  s3Endpoint: string;
  minioClient: MinioClient;
  logger: Logger;
  req: Request;
}): Promise<Context> => {
  const { db, s3, s3Endpoint, minioClient, logger, req } = config;
  const sessionId = getSessionId(req);

  // Find first user session matching session id and authenticated user
  const session = await db.query.userSessions.findFirst({
    where: and(eq(userSessions.session_id, sessionId)),
    with: { user: true },
  });

  if (session) {
    if (session.user.type === 'authenticated') {
      return buildContext({
        db,
        s3,
        s3Endpoint,
        minioClient,
        logger,
        sessionId,
        userId: session.user_id as UserId,
        userSessionId: session.id as UserSessionId,
      });
    } else if (session.user.type === 'anonymous') {
      return buildContext({
        db,
        s3,
        s3Endpoint,
        minioClient,
        logger,
        sessionId,
        userId: session.user_id as UserId,
        userSessionId: session.id as UserSessionId,
      });
    }
  }

  // No session exists, create new anonymous user/session
  const { userId: newUserId, userSessionId: newUserSessionId } = await db.transaction(
    async (tx) => {
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
    },
  );

  return buildContext({
    db,
    s3,
    s3Endpoint,
    minioClient,
    logger,
    sessionId,
    userId: newUserId,
    userSessionId: newUserSessionId,
  });
};

// Initialize tRPC
const t = initTRPC.context<Context>().create();

// Export procedure creator and router helper
export const procedure = t.procedure;
export const router = t.router;
