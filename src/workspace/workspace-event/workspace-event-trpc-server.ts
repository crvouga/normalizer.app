import { z } from 'zod';
import { createArtifactDb } from '~/src/artifacts/artifact-db';
import { ResourceOwnershipEntity } from '~/src/permissions/resource-ownership-entity';
import { ResourceOwnershipEntityId } from '~/src/permissions/resource-ownership-entity-id';
import { enqueueJob } from '../../shared/graphile-worker';
import { procedure, router } from '../../shared/trpc-server';
import { WorkspaceEvent } from './workspace-event';
import { createWorkspaceEventDb } from './workspace-event-db';
import { WorkspaceEventEntity } from './workspace-event-entity';
import { WorkspaceEventId } from './workspace-event-id';
import { WorkspaceId } from '../workspace-id';
import { WorkspacePayload } from '../workspace-payload/workspace-payload';
import { WorkspaceProjection } from '../workspace-projection/workspace-projection';
import { createWorkspaceProjectionDb } from '../workspace-projection/workspace-projection-db';

export const workspaceEventRouter = router({
  /**
   * Append a new event to a workspace
   */
  append: procedure
    .input(
      z.object({
        workspaceId: WorkspaceId.schema,
        event: WorkspaceEvent.schema,
      }),
    )
    .output(WorkspacePayload.schema)
    .mutation(async ({ input, ctx }) => {
      const eventId = WorkspaceEventId.generate();
      ctx.logger.info('Workspace event append', {
        sessionId: input.workspaceId,
        eventId,
        eventType: input.event.type,
        userId: ctx.userId,
      });
      const event: WorkspaceEventEntity = {
        id: eventId,
        workspace_id: input.workspaceId,
        event: input.event,
        created_at: new Date(),
      };
      await ctx.db.transaction(async (tx) => {
        const projectionDb = createWorkspaceProjectionDb({ tx, logger: ctx.logger });
        const projectionBefore = await projectionDb.load(input.workspaceId, ctx.userId);
        const eventDb = createWorkspaceEventDb({ tx, logger: ctx.logger });
        await eventDb.append(event);
        const projection = await projectionDb.refresh(input.workspaceId, ctx.userId);
        if (WorkspaceProjection.shouldStartNormalizationJob(projectionBefore, projection)) {
          await enqueueJob(tx, { type: 'normalization', sessionId: input.workspaceId });
        }
      });
      // After commit, load full payload to return
      const projectionDb = createWorkspaceProjectionDb({
        tx: ctx.db,
        logger: ctx.logger,
      });
      const ownerId = await projectionDb.getOwner(input.workspaceId);
      if (!ownerId) {
        throw new Error('Workspace not found');
      }
      const eventsDb = createWorkspaceEventDb({ tx: ctx.db, logger: ctx.logger });
      const events = await eventsDb.getByWorkspaceId(input.workspaceId);
      const projection = await projectionDb.load(input.workspaceId, ownerId);
      const artifactIds = WorkspaceProjection.toArtifactIds(projection);
      const artifactDb = createArtifactDb({ tx: ctx.db, logger: ctx.logger });
      const artifacts = await artifactDb.getRefreshed(artifactIds, ctx.objectStore);

      const resourceOwnership: ResourceOwnershipEntity[] = [
        {
          id: ResourceOwnershipEntityId.create('workspace', input.workspaceId),
          resourceType: 'workspace',
          resourceId: input.workspaceId,
          ownerId,
        },
      ];
      const payload: WorkspacePayload = {
        workspaceEvents: events,
        workspaceProjections: [projection],
        artifacts,
        resourceOwnership,
      };
      return payload;
    }),
});
