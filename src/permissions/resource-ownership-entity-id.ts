import { z } from 'zod';
import type { ResourceType } from './permission';

export const schema = z.string().brand<'ResourceOwnershipEntityId'>();

export type ResourceOwnershipEntityId = z.infer<typeof schema>;

/**
 * Create a resource ownership entity ID from resource type and resourceId
 * Format: ${resourceType}:${resourceId}
 */
const create = (resourceType: ResourceType, resourceId: string): ResourceOwnershipEntityId => {
  return schema.parse(`${resourceType}:${resourceId}`);
};

export const ResourceOwnershipEntityId = {
  schema,
  create,
};
