import type { UserId } from '../users/user-id';
import type { Permission, PermissionCheckResult } from './permission';
import { granted, denied, isGranted } from './permission';

/**
 * Context provided to policies for authorization decisions
 */
export interface PolicyContext {
  userId: UserId;
  permission: Permission;
  [key: string]: unknown;
}

/**
 * A policy evaluates whether a permission should be granted
 */
export interface Policy {
  /**
   * Name of the policy for logging/debugging
   */
  name: string;

  /**
   * Evaluate the policy
   * @returns PermissionCheckResult indicating if permission is granted
   */
  evaluate(context: PolicyContext): Promise<PermissionCheckResult> | PermissionCheckResult;
}

/**
 * Composes multiple policies with AND logic (all must pass)
 */
export class AllPoliciesRequired implements Policy {
  public readonly name = 'AllPoliciesRequired';

  constructor(private policies: Policy[]) {}

  async evaluate(context: PolicyContext): Promise<PermissionCheckResult> {
    for (const policy of this.policies) {
      const result = await policy.evaluate(context);
      if (!isGranted(result)) {
        return denied(`Policy '${policy.name}' failed: ${result.reason}`);
      }
    }
    return granted();
  }
}

/**
 * Composes multiple policies with OR logic (at least one must pass)
 */
export class AnyPolicyRequired implements Policy {
  public readonly name = 'AnyPolicyRequired';

  constructor(private policies: Policy[]) {}

  async evaluate(context: PolicyContext): Promise<PermissionCheckResult> {
    const reasons: string[] = [];
    for (const policy of this.policies) {
      const result = await policy.evaluate(context);
      if (isGranted(result)) {
        return granted();
      }
      reasons.push(`${policy.name}: ${result.reason}`);
    }
    return denied(`All policies failed: ${reasons.join('; ')}`);
  }
}

/**
 * PolicyEngine evaluates permissions against registered policies
 */
export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();

  /**
   * Register a policy for a specific resource-action combination
   */
  registerPolicy(resource: string, action: string, policy: Policy): void {
    const key = this.makeKey(resource, action);
    this.policies.set(key, policy);
  }

  /**
   * Check if a permission is granted
   */
  async check(context: PolicyContext): Promise<PermissionCheckResult> {
    const { permission } = context;
    const key = this.makeKey(permission.resource, permission.action);
    const policy = this.policies.get(key);

    if (!policy) {
      // No policy registered - deny by default (fail-safe)
      return denied(`No policy registered for ${permission.resource}:${permission.action}`);
    }

    return await policy.evaluate(context);
  }

  /**
   * Check if a permission is granted, throwing an error if not
   */
  async authorize(context: PolicyContext): Promise<void> {
    const result = await this.check(context);
    if (!isGranted(result)) {
      throw new Error(`Authorization failed: ${result.reason}`);
    }
  }

  private makeKey(resource: string, action: string): string {
    return `${resource}:${action}`;
  }
}
