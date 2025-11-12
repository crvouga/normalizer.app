import { z } from 'zod';
import { ResourceType, Action } from './permission';
import { PermissionEntityId } from './permission-entity-id';

export const schema = z.object({
  id: PermissionEntityId.schema,
  resource: ResourceType,
  action: Action,
  resourceId: z.string(),
  granted: z.boolean(),
  reason: z.string().optional(),
});

export type PermissionEntity = z.infer<typeof schema>;

export const PermissionEntity = {
  schema,
};
