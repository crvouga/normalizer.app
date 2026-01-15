import { z } from 'zod';
import { WorkspaceEventId } from './workspace-event-id';
import { WorkspaceId } from '../workspace-id';
import { WorkspaceEvent } from './workspace-event';

/**
 * Zod schema for the WorkspaceEventEntity, matching the database schema.
 */
const schema = z.object({
  id: WorkspaceEventId.schema,
  workspace_id: WorkspaceId.schema,
  event: WorkspaceEvent.schema,
  created_at: z.coerce.date(),
});

export type WorkspaceEventEntity = z.infer<typeof schema>;

export const WorkspaceEventEntity = {
  schema,
};
