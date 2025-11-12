import { z } from 'zod';
import { ResourceType } from './permission';
import { ResourceOwnershipEntityId } from './resource-ownership-entity-id';
import { UserId } from '../users/user-id';

export const schema = z.object({
  id: ResourceOwnershipEntityId.schema,
  resourceType: ResourceType,
  resourceId: z.string(),
  ownerId: UserId.schema,
});

export type ResourceOwnershipEntity = z.infer<typeof schema>;

export const ResourceOwnershipEntity = {
  schema,
};
