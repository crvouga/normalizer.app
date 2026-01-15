import { createPermission } from '../permissions/permission';
import { createResourceOwnershipPolicy } from '../permissions/policies/resource-ownership-policy';
import type { WorkspaceId } from './workspace-id';

/**
 * Create a permission to view a workspace
 */
export function canViewWorkspace(workspaceId: WorkspaceId) {
  return createPermission('workspace', 'view', workspaceId);
}

/**
 * Create a permission to edit a workspace
 */
export function canEditWorkspace(workspaceId: WorkspaceId) {
  return createPermission('workspace', 'edit', workspaceId);
}

/**
 * Create a permission to delete a workspace
 */
export function canDeleteWorkspace(workspaceId: WorkspaceId) {
  return createPermission('workspace', 'delete', workspaceId);
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
