import { z } from 'zod';
import type { ResourceType, Action } from './permission';

export const schema = z.string().brand<'PermissionEntityId'>();

export type PermissionEntityId = z.infer<typeof schema>;

/**
 * Create a composite permission entity ID from resource, action, and resourceId
 * Format: ${resource}:${action}:${resourceId}
 */
const create = (resource: ResourceType, action: Action, resourceId: string): PermissionEntityId => {
  return schema.parse(`${resource}:${action}:${resourceId}`);
};

export const PermissionEntityId = {
  schema,
  create,
};
