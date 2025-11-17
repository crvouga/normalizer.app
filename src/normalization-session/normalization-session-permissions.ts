import { createPermission } from '../permissions/permission';
import { createResourceOwnershipPolicy } from '../permissions/policies/resource-ownership-policy';
import type { NormalizationSessionId } from './normalization-session-id';

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
