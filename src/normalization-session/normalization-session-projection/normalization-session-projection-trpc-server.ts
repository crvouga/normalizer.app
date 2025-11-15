import { z } from 'zod';
import type { S3Client } from 'bun';
import type { Logger } from '~/src/lib/logger';
import { AppNotification } from '~/src/shared/app-notification';
import type { Db, Tx } from '~/src/shared/sql';
import { procedure, router } from '~/src/shared/trpc-server';
import type { UserId } from '~/src/users/user-id';
import { Artifact } from '~/src/artifacts/artifact';
import { ArtifactDb } from '~/src/artifacts/artifact-db';
import { ArtifactId } from '~/src/artifacts/artifact-id';
import { ResourceOwnershipEntity } from '~/src/permissions/resource-ownership-entity';
import { ResourceOwnershipEntityId } from '~/src/permissions/resource-ownership-entity-id';
import { NormalizationSessionId } from '../normalization-session-id';
import {
  canViewNormalizationSession,
  getNormalizationSessionOwner,
  viewNormalizationSessionPolicy,
} from '../normalization-session-permissions';
import { NormalizationSessionProjection } from './normalization-session-projection';
import { NormalizationSessionProjectionDb } from './normalization-session-projection-db';
import { zAsyncIterable } from '~/src/lib/zod-async-iterable';

export const normalizationSessionProjectionRouter = router({
  subscribe: procedure
    .input(
      z.object({
        id: NormalizationSessionId.schema,
      }),
    )
    .output(
      zAsyncIterable({
        yield: z.object({
          projection: NormalizationSessionProjection.schema,
          artifacts: z.array(Artifact.schema),
          resourceOwnership: z.array(ResourceOwnershipEntity.schema),
        }),
      }),
    )
    .subscription(async function* ({ input, ctx }) {
      const { id: sessionId } = input;
      const permission = canViewNormalizationSession(sessionId);
      const resourceOwnerId = await getNormalizationSessionOwner(ctx.db, sessionId);

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
        s3: ctx.s3,
        s3Endpoint: ctx.s3Endpoint,
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
            s3: ctx.s3,
            s3Endpoint: ctx.s3Endpoint,
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
  s3: S3Client;
  s3Endpoint: string;
}): Promise<{
  projection: NormalizationSessionProjection;
  artifacts: Artifact[];
  resourceOwnership: ResourceOwnershipEntity[];
} | null> => {
  const { db, logger, sessionId, ownerId, s3, s3Endpoint } = input;
  try {
    const projectionDb = new NormalizationSessionProjectionDb(db, logger);
    const projection = await projectionDb.load(sessionId, ownerId);

    // Collect all artifact IDs from the projection
    const artifactIds = new Set<string>();

    // Add target artifact IDs
    for (const artifactId of projection.targetArtifactIds) {
      artifactIds.add(artifactId);
    }

    // Add artifact IDs from entries (input and output)
    for (const entry of projection.entries) {
      for (const artifactId of entry.inputArtifactIds) {
        artifactIds.add(artifactId);
      }
      for (const artifactId of entry.outputArtifactIds) {
        artifactIds.add(artifactId);
      }
    }

    // Fetch artifacts
    let artifacts: Artifact[] = [];
    if (artifactIds.size > 0) {
      const artifactDb = new ArtifactDb(db, logger);
      artifacts = await artifactDb.getByIds(Array.from(artifactIds) as ArtifactId[]);
      // Populate artifact URLs
      artifacts = await artifactDb.refreshUrls({
        artifacts,
        s3,
        s3Endpoint,
      });
    }

    // Create resource ownership entity
    const resourceOwnership: ResourceOwnershipEntity[] = [
      {
        id: ResourceOwnershipEntityId.create('normalization-session', sessionId),
        resourceType: 'normalization-session',
        resourceId: sessionId,
        ownerId,
      },
    ];

    return {
      projection,
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
