import z from 'zod';
import { Artifact } from '~/src/artifacts/artifact';
import { ResourceOwnershipEntity } from '~/src/permissions/resource-ownership-entity';
import { WorkspaceEventEntity } from '../workspace-event/workspace-event-entity';
import { WorkspaceProjection } from '../workspace-projection/workspace-projection';

const schema = z.object({
  workspaceEvents: z.array(WorkspaceEventEntity.schema),
  workspaceProjections: z.array(WorkspaceProjection.schema),
  artifacts: z.array(Artifact.schema),
  resourceOwnership: z.array(ResourceOwnershipEntity.schema),
});

export type WorkspacePayload = z.infer<typeof schema>;

export const WorkspacePayload = {
  schema,
};
