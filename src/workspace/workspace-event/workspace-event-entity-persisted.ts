import { z } from 'zod';
import { WorkspaceId } from '../workspace-id';
import type { WorkspaceEventEntity } from './workspace-event-entity';
import { WorkspaceEventId } from './workspace-event-id';
import { WorkspaceEventPersisted } from './workspace-event-persisted';

/**
 * Zod schema for the WorkspaceEventEntityPersisted, matching the database schema.
 */
const schema = z.object({
  id: WorkspaceEventId.schema,
  workspace_id: WorkspaceId.schema,
  event: WorkspaceEventPersisted.schema,
  created_at: z.coerce.date(),
});

export type WorkspaceEventEntityPersisted = z.infer<typeof schema>;

function migrate(persisted: WorkspaceEventEntityPersisted): WorkspaceEventEntity {
  return {
    ...persisted,
    event: WorkspaceEventPersisted.migrate(persisted.event),
  };
}

export const WorkspaceEventEntityPersisted = {
  schema,
  migrate,
};
