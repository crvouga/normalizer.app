import { z } from 'zod';

/**
 * Resource types in the application
 */
export const ResourceType = z.enum([
  'workspace',
  'artifact',
  'user',
  // Future: Add more resource types as needed
]);
export type ResourceType = z.infer<typeof ResourceType>;

/**
 * Actions that can be performed on resources
 */
export const Action = z.enum([
  'view',
  'edit',
  'delete',
  'create',
  // Future: Add more granular actions as needed
]);
export type Action = z.infer<typeof Action>;

/**
 * Permission represents a request to perform an action on a resource
 */
export const Permission = z.object({
  resource: ResourceType,
  action: Action,
  resourceId: z.string().optional(),
});
export type Permission = z.infer<typeof Permission>;

/**
 * Result of a permission check
 */
export type PermissionCheckResult = { granted: true } | { granted: false; reason: string };

/**
 * Helper to create a permission
 */
export function createPermission(
  resource: ResourceType,
  action: Action,
  resourceId?: string,
): Permission {
  return { resource, action, resourceId };
}

/**
 * Helper to create a granted permission result
 */
export function granted(): PermissionCheckResult {
  return { granted: true };
}

/**
 * Helper to create a denied permission result
 */
export function denied(reason: string): PermissionCheckResult {
  return { granted: false, reason };
}

/**
 * Type guard to check if result is granted
 */
export function isGranted(result: PermissionCheckResult): result is { granted: true } {
  return result.granted === true;
}
