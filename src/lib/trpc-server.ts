import { initTRPC } from '@trpc/server';
import type { S3Client } from 'bun';
import type { Logger } from './logger';
import type { Db } from '../sql';
import type { MinioClient } from './minio/minio-client';
import { getSessionId } from './session-id-cookie';
import type { SessionId } from './session-id';
import type { UserId } from '../users/user-id';
import type { UserSessionId } from '../users/user-session-id';
import { users, userSessions } from '../db/schema';
import { UserId as UserIdHelper } from '../users/user-id';
import { UserSessionId as UserSessionIdHelper } from '../users/user-session-id';
import { findCurrentUserSession } from '../users/user-session-queries';
import { AuthorizationError } from '../permissions/authorization-error';
import type { Permission, PermissionCheckResult } from '../permissions/permission';
import { isGranted } from '../permissions/permission';
import type { Policy, PolicyContext } from '../permissions/policy';

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
  // Authorization utilities
  authorize: (
    permission: Permission,
    policy: Policy,
    additionalContext?: Record<string, unknown>,
  ) => Promise<void>;
  checkPermission: (
    permission: Permission,
    policy: Policy,
    additionalContext?: Record<string, unknown>,
  ) => Promise<PermissionCheckResult>;
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
  /**
   * Check a permission using a policy
   */
  const checkPermission = async (
    permission: Permission,
    policy: Policy,
    additionalContext?: Record<string, unknown>,
  ): Promise<PermissionCheckResult> => {
    const context: PolicyContext = {
      userId,
      permission,
      ...additionalContext,
    };

    logger.debug('Checking permission', {
      userId,
      resource: permission.resource,
      action: permission.action,
      resourceId: permission.resourceId,
      policy: policy.name,
    });

    const result = await policy.evaluate(context);

    logger.info('Permission check result', {
      userId,
      resource: permission.resource,
      action: permission.action,
      resourceId: permission.resourceId,
      policy: policy.name,
      granted: isGranted(result),
    });

    return result;
  };

  /**
   * Authorize a permission using a policy, throwing if denied
   */
  const authorize = async (
    permission: Permission,
    policy: Policy,
    additionalContext?: Record<string, unknown>,
  ): Promise<void> => {
    const result = await checkPermission(permission, policy, additionalContext);

    if (!isGranted(result)) {
      throw new AuthorizationError({
        permission,
        userId,
        reason: result.reason,
      });
    }
  };

  return {
    db,
    s3,
    s3Endpoint,
    minioClient,
    logger,
    sessionId,
    userId,
    userSessionId,
    authorize,
    checkPermission,
  };
}

// Create context function: find first NON-ENDED authenticated session, else fall back to anonymous session
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

  if (!sessionId) {
    throw new Error('No session ID found');
  }

  // Try to find existing session (authenticated or anonymous)
  const currentSession = await findCurrentUserSession(db, sessionId);

  if (currentSession) {
    return buildContext({
      db,
      s3,
      s3Endpoint,
      minioClient,
      logger,
      sessionId,
      userId: currentSession.user_id as UserId,
      userSessionId: currentSession.id as UserSessionId,
    });
  }

  // No session exists - create new anonymous user/session
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
