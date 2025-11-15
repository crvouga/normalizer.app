import { eq } from 'drizzle-orm';
import type { Db } from '../shared/sql';
import type { UserId } from '../users/user-id';
import { createPermission } from '../permissions/permission';
import { createResourceOwnershipPolicy } from '../permissions/policies/resource-ownership-policy';
import type { PolicyContext } from '../permissions/policy';
import type { NormalizationSessionId } from './normalization-session-id';
import { normalizationSessionProjections } from '../db/schema';
import { NormalizationSessionProjection } from './normalization-session-projection/normalization-session-projection';

/**
 * Create a permission to view a normalization session
 */
export function canViewNormalizationSession(sessionId: NormalizationSessionId) {
  return createPermission('normalization-session', 'view', sessionId);
}

/**
 * Create a permission to edit a normalization session
 */
export function canEditNormalizationSession(sessionId: NormalizationSessionId) {
  return createPermission('normalization-session', 'edit', sessionId);
}

/**
 * Create a permission to delete a normalization session
 */
export function canDeleteNormalizationSession(sessionId: NormalizationSessionId) {
  return createPermission('normalization-session', 'delete', sessionId);
}

/**
 * Policy for viewing normalization sessions
 */
export const viewNormalizationSessionPolicy = createResourceOwnershipPolicy();

/**
 * Policy for editing normalization sessions
 */
export const editNormalizationSessionPolicy = createResourceOwnershipPolicy();

/**
 * Policy for deleting normalization sessions
 */
export const deleteNormalizationSessionPolicy = createResourceOwnershipPolicy();

/**
 * Fetch the owner of a normalization session
 */
export async function getNormalizationSessionOwner(
  db: Db,
  sessionId: NormalizationSessionId,
): Promise<UserId | null> {
  const projection = await db
    .select()
    .from(normalizationSessionProjections)
    .where(eq(normalizationSessionProjections.normalization_session_id, sessionId))
    .limit(1);

  const firstProjection = projection[0];
  if (!firstProjection) {
    return null;
  }

  const parsed = NormalizationSessionProjection.schema.parse(firstProjection.projection);
  return parsed.startedByUserId;
}

/**
 * Create a policy context for normalization session authorization
 */
export async function createNormalizationSessionPolicyContext(
  db: Db,
  userId: UserId,
  sessionId: NormalizationSessionId,
  action: 'view' | 'edit' | 'delete',
): Promise<PolicyContext & { resourceOwnerId: UserId | null }> {
  const resourceOwnerId = await getNormalizationSessionOwner(db, sessionId);

  return {
    userId,
    permission: createPermission('normalization-session', action, sessionId),
    resourceOwnerId,
  };
}
