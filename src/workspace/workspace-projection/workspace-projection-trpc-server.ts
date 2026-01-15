import type { ObjectStore } from '~/src/lib/object-store/object-store';
import { z } from 'zod';
import { Artifact } from '~/src/artifacts/artifact';
import { ArtifactDb } from '~/src/artifacts/artifact-db';
import { ArtifactId } from '~/src/artifacts/artifact-id';
import type { Logger } from '~/src/lib/logger';
import { zAsyncIterable } from '~/src/lib/zod-async-iterable';
import { ResourceOwnershipEntity } from '~/src/permissions/resource-ownership-entity';
import { ResourceOwnershipEntityId } from '~/src/permissions/resource-ownership-entity-id';
import { AppNotification } from '~/src/shared/app-notification';
import type { Db, Tx } from '~/src/shared/db';
import { procedure, router } from '~/src/shared/trpc-server';
import type { UserId } from '~/src/users/user-id';
import { WorkspaceEventDb } from '../workspace-event/workspace-event-db';
import { WorkspaceId } from '../workspace-id';
import { WorkspacePayload } from '../workspace-payload/workspace-payload';
import { canViewWorkspace, viewWorkspacePolicy } from '../workspace-permissions';
import { WorkspaceProjectionDb } from './workspace-projection-db';

export const workspaceProjectionRouter = router({
  fetch: procedure
    .input(
      z.object({
        id: WorkspaceId.schema,
      }),
    )
    .output(WorkspacePayload.schema)
    .query(async ({ input, ctx }) => {
      const { id: sessionId } = input;
      const permission = canViewWorkspace(sessionId);
      const projectionDb = new WorkspaceProjectionDb(ctx.db, ctx.logger);
      const resourceOwnerId = await projectionDb.getOwner(sessionId);

      if (!resourceOwnerId) throw new Error('Workspace not found');

      await ctx.authorize(permission, viewWorkspacePolicy, { resourceOwnerId });

      const data = await load({
        db: ctx.db,
        logger: ctx.logger,
        sessionId,
        ownerId: resourceOwnerId,
        objectStore: ctx.objectStore,
      });

      if (!data) throw new Error('Failed to load projection');
      return data;
    }),
  subscribe: procedure
    .input(
      z.object({
        id: WorkspaceId.schema,
      }),
    )
    .output(
      zAsyncIterable({
        yield: WorkspacePayload.schema,
      }),
    )
    .subscription(async function* ({ input, ctx }) {
      const { id: sessionId } = input;
      const permission = canViewWorkspace(sessionId);
      const projectionDb = new WorkspaceProjectionDb(ctx.db, ctx.logger);
      const resourceOwnerId = await projectionDb.getOwner(sessionId);

      if (!resourceOwnerId) throw new Error('Workspace not found');

      await ctx.authorize(permission, viewWorkspacePolicy, { resourceOwnerId });

      ctx.logger.info('Workspace projection subscription started', {
        sessionId,
        userId: ctx.userId,
      });

      const data = await load({
        db: ctx.db,
        logger: ctx.logger,
        sessionId,
        ownerId: resourceOwnerId,
        objectStore: ctx.objectStore,
      });
      if (!data) throw new Error('Failed to load initial projection');

      yield data;

      const appNotification = new AppNotification(ctx.db);

      try {
        const notifications = appNotification.subscribe('workspace_projection_update');

        for await (const notifiedSessionId of notifications) {
          if (notifiedSessionId !== sessionId) continue;

          const data = await load({
            db: ctx.db,
            logger: ctx.logger,
            sessionId,
            ownerId: resourceOwnerId,
            objectStore: ctx.objectStore,
          });

          if (!data) continue;

          yield data;
        }
      } finally {
        ctx.logger.info('Workspace projection subscription ended', {
          sessionId,
          userId: ctx.userId,
        });
      }
    }),
});

const load = async (input: {
  db: Db | Tx;
  logger: Logger;
  sessionId: WorkspaceId;
  ownerId: UserId;
  objectStore: ObjectStore;
}): Promise<WorkspacePayload | null> => {
  const { db, logger, sessionId, ownerId, objectStore } = input;
  try {
    const sessionProjectionDb = new WorkspaceProjectionDb(db, logger);
    const workspaceEventDb = new WorkspaceEventDb(db, logger);
    const sessionEvents = await workspaceEventDb.getBySessionId(sessionId);
    const sessionProjection = await sessionProjectionDb.load(sessionId, ownerId);

    const artifactIds = new Set<string>();

    for (const artifactId of sessionProjection.targetArtifactIds) {
      artifactIds.add(artifactId);
    }

    for (const entry of sessionProjection.entries) {
      for (const artifactId of entry.inputArtifactIds) {
        artifactIds.add(artifactId);
      }
      for (const artifactId of entry.outputArtifactIds) {
        artifactIds.add(artifactId);
      }
    }

    let artifacts: Artifact[] = [];
    if (artifactIds.size > 0) {
      const artifactDb = new ArtifactDb(db, logger);
      artifacts = await artifactDb.getByIds(Array.from(artifactIds) as ArtifactId[]);

      artifacts = await artifactDb.refresh({
        artifacts,
        objectStore,
      });
    }

    const resourceOwnership: ResourceOwnershipEntity[] = [
      {
        id: ResourceOwnershipEntityId.create('workspace', sessionId),
        resourceType: 'workspace',
        resourceId: sessionId,
        ownerId,
      },
    ];

    return {
      workspaceProjections: [sessionProjection],
      workspaceEvents: sessionEvents,
      artifacts,
      resourceOwnership,
    };
  } catch (error) {
    logger.error('Failed to load projection', {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};
