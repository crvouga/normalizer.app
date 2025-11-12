import { useEntityStoreSelector } from '../store/entity-store';
import { useCurrentUser } from '../users/use-current-user';
import type { Permission } from './permission';
import type { Policy, PolicyContext } from './policy';
import { ResourceOwnershipEntityId } from './resource-ownership-entity-id';

export interface UsePolicyCheckResult {
  granted: boolean;
  isLoading: boolean;
  reason: string | null;
}

/**
 * Hook to execute a policy check client-side
 *
 * This hook:
 * 1. Gets the current user
 * 2. Looks up resource ownership from entity store
 * 3. Builds a PolicyContext
 * 4. Executes the policy synchronously
 *
 * @param permission - The permission to check (must include resourceId)
 * @param policy - The policy to execute
 * @param extraContext - Optional extra context to merge into PolicyContext
 * @returns Object with granted status, loading state, and optional reason
 */
export function usePolicyCheck(
  permission: Permission,
  policy: Policy,
  extraContext?: Partial<PolicyContext>,
): UsePolicyCheckResult {
  // Get current user
  const currentUser = useCurrentUser();

  // Permission must have a resourceId to look up ownership
  if (!permission.resourceId) {
    return {
      granted: false,
      isLoading: false,
      reason: 'Permission check requires a resourceId',
    };
  }

  // Look up resource ownership in entity store
  const resourceOwnershipId = ResourceOwnershipEntityId.create(
    permission.resource,
    permission.resourceId,
  );

  const resourceOwnership = useEntityStoreSelector((state) => {
    return state.entities.resourceOwnerships.byId[resourceOwnershipId];
  });

  // If resource ownership doesn't exist in store, it's still loading
  if (!resourceOwnership) {
    return {
      granted: false,
      isLoading: true,
      reason: null,
    };
  }

  // Build the policy context
  const policyContext: PolicyContext = {
    userId: currentUser.id,
    permission,
    resourceOwnerId: resourceOwnership.ownerId,
    ...extraContext,
  };

  // Execute the policy synchronously
  const result = policy.evaluate(policyContext);

  return {
    granted: result.granted,
    isLoading: false,
    reason: result.granted ? null : result.reason,
  };
}
