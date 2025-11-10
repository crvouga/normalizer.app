import { initTRPC } from '@trpc/server';
import type { S3Client } from 'bun';
import type { Logger } from './logger';
import type { Db } from '../sql';
import type { MinioClient } from './minio/minio-client';
import { getSessionId } from './session-id-cookie';
import type { SessionId } from './session-id';
import type { UserId } from '../users/user-id';
import type { UserSessionId } from '../users/user-session-id';
import { eq } from 'drizzle-orm';
import { users, userSessions } from '../db/schema';
import { UserId as UserIdHelper } from '../users/user-id';
import { UserSessionId as UserSessionIdHelper } from '../users/user-session-id';

// Create context type
export type Context = {
  db: Db;
  s3: S3Client;
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
  minioClient: MinioClient;
  logger: Logger;
  req: Request;
}): Promise<Context> => {
  const { db, s3, minioClient, logger, req } = config;

  // Get or generate session ID
  const sessionId = getSessionId(req);

  // Find or create user session
  let userSession = await db.query.userSessions.findFirst({
    where: eq(userSessions.session_id, sessionId),
  });

  let userId: UserId;
  let userSessionId: UserSessionId;

  if (!userSession) {
    // Create new anonymous user
    userId = UserIdHelper.generate();
    await db.insert(users).values({
      id: userId,
      type: 'anonymous',
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Create new user session
    userSessionId = UserSessionIdHelper.generate();
    await db.insert(userSessions).values({
      id: userSessionId,
      session_id: sessionId,
      user_id: userId,
      started_at: new Date(),
    });
  } else {
    userId = userSession.user_id as UserId;
    userSessionId = userSession.id as UserSessionId;
  }

  return {
    db,
    s3,
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
