import { createPermission } from '../permissions/permission';
import { createResourceOwnershipPolicy } from '../permissions/policies/resource-ownership-policy';
import type { WorkspaceId } from './workspace-id';

/**
 * Create a permission to view a workspace
 */
export function canViewWorkspace(sessionId: WorkspaceId) {
  return createPermission('workspace', 'view', sessionId);
}

/**
 * Create a permission to edit a workspace
 */
export function canEditWorkspace(sessionId: WorkspaceId) {
  return createPermission('workspace', 'edit', sessionId);
}

/**
 * Create a permission to delete a workspace
 */
export function canDeleteWorkspace(sessionId: WorkspaceId) {
  return createPermission('workspace', 'delete', sessionId);
}

/**
 * Policy for viewing workspaces
 */
export const viewWorkspacePolicy = createResourceOwnershipPolicy();

/**
 * Policy for editing workspaces
 */
export const editWorkspacePolicy = createResourceOwnershipPolicy();

/**
 * Policy for deleting workspaces
 */
export const deleteWorkspacePolicy = createResourceOwnershipPolicy();
