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
import type { Db, Tx } from '~/src/shared/sql';
import { procedure, router } from '~/src/shared/trpc-server';
import type { UserId } from '~/src/users/user-id';
import { NormalizationSessionEventDb } from '../normalization-session-event/normalization-session-event-db';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionPayload } from '../normalization-session-payload/normalization-session-payload';
import {
  canViewNormalizationSession,
  viewNormalizationSessionPolicy,
} from '../normalization-session-permissions';
import { NormalizationSessionProjectionDb } from './normalization-session-projection-db';

export const normalizationSessionProjectionRouter = router({
  fetch: procedure
    .input(
      z.object({
        id: NormalizationSessionId.schema,
      }),
    )
    .output(NormalizationSessionPayload.schema)
    .query(async ({ input, ctx }) => {
      const { id: sessionId } = input;
      const permission = canViewNormalizationSession(sessionId);
      const projectionDb = new NormalizationSessionProjectionDb(ctx.db, ctx.logger);
      const resourceOwnerId = await projectionDb.getOwner(sessionId);

      if (!resourceOwnerId) throw new Error('Normalization session not found');

      await ctx.authorize(permission, viewNormalizationSessionPolicy, { resourceOwnerId });

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
        id: NormalizationSessionId.schema,
      }),
    )
    .output(
      zAsyncIterable({
        yield: NormalizationSessionPayload.schema,
      }),
    )
    .subscription(async function* ({ input, ctx }) {
      const { id: sessionId } = input;
      const permission = canViewNormalizationSession(sessionId);
      const projectionDb = new NormalizationSessionProjectionDb(ctx.db, ctx.logger);
      const resourceOwnerId = await projectionDb.getOwner(sessionId);

      if (!resourceOwnerId) throw new Error('Normalization session not found');

      await ctx.authorize(permission, viewNormalizationSessionPolicy, { resourceOwnerId });

      ctx.logger.info('Normalization session projection subscription started', {
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
        const notifications = appNotification.subscribe('normalization_session_projection_update');

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
        ctx.logger.info('Normalization session projection subscription ended', {
          sessionId,
          userId: ctx.userId,
        });
      }
    }),
});

const load = async (input: {
  db: Db | Tx;
  logger: Logger;
  sessionId: NormalizationSessionId;
  ownerId: UserId;
  objectStore: ObjectStore;
}): Promise<NormalizationSessionPayload | null> => {
  const { db, logger, sessionId, ownerId, objectStore } = input;
  try {
    const sessionProjectionDb = new NormalizationSessionProjectionDb(db, logger);
    const normalizationSessionEventDb = new NormalizationSessionEventDb(db, logger);
    const sessionEvents = await normalizationSessionEventDb.getBySessionId(sessionId);
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

      artifacts = await artifactDb.refreshUrls({
        artifacts,
        objectStore,
      });
    }

    const resourceOwnership: ResourceOwnershipEntity[] = [
      {
        id: ResourceOwnershipEntityId.create('normalization-session', sessionId),
        resourceType: 'normalization-session',
        resourceId: sessionId,
        ownerId,
      },
    ];

    return {
      sessionProjections: [sessionProjection],
      sessionEvents,
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
