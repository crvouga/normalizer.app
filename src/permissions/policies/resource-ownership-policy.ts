import type { UserId } from '../../users/user-id';
import type { Policy, PolicyContext } from '../policy';
import type { PermissionCheckResult } from '../permission';
import { granted, denied } from '../permission';

/**
 * Context for resource ownership checks
 */
export interface ResourceOwnershipContext extends PolicyContext {
  resourceOwnerId: UserId;
}

/**
 * Policy that grants permission if the user is the owner of the resource
 */
export class ResourceOwnershipPolicy implements Policy {
  public readonly name = 'ResourceOwnership';

  evaluate(context: PolicyContext): PermissionCheckResult {
    const ownershipContext = context as ResourceOwnershipContext;

    if (!ownershipContext.resourceOwnerId) {
      return denied('Resource owner not specified');
    }

    if (ownershipContext.userId === ownershipContext.resourceOwnerId) {
      return granted();
    }

    return denied('User is not the owner of this resource');
  }
}

/**
 * Factory function to create a resource ownership policy
 */
export function createResourceOwnershipPolicy(): ResourceOwnershipPolicy {
  return new ResourceOwnershipPolicy();
}
