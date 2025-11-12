import { useEntityStoreSelector } from '../store/entity-store';
import type { Permission } from './permission';
import { PermissionEntityId } from './permission-entity-id';

export interface UsePermissionResult {
  granted: boolean;
  isLoading: boolean;
  reason: string | null;
}

/**
 * Hook to check permissions from entity store
 *
 * This hook looks up permission entities in the store based on the given permission.
 * The permission must have been previously loaded into the store (e.g., from a tRPC response).
 *
 * @param permission - The permission to check (must include resourceId)
 * @returns Object with granted status, loading state, and optional reason
 */
export function usePermission(permission: Permission): UsePermissionResult {
  // Permission must have a resourceId to be looked up in entity store
  if (!permission.resourceId) {
    return {
      granted: false,
      isLoading: false,
      reason: 'Permission check requires a resourceId',
    };
  }

  // Create the composite ID to look up the permission entity
  const permissionId = PermissionEntityId.create(
    permission.resource,
    permission.action,
    permission.resourceId,
  );

  // Look up the permission entity in the store
  const permissionEntity = useEntityStoreSelector((state) => {
    return state.entities.permissions.byId[permissionId];
  });

  // If permission entity doesn't exist in store, it's still loading
  if (!permissionEntity) {
    return {
      granted: false,
      isLoading: true,
      reason: null,
    };
  }

  // Return the permission result from the entity
  return {
    granted: permissionEntity.granted,
    isLoading: false,
    reason: permissionEntity.reason ?? null,
  };
}
