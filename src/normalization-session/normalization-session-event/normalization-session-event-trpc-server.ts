import { z } from 'zod';
import { enqueueJob } from '../../shared/graphile-worker';
import { procedure, router } from '../../shared/trpc-server';
import { NormalizationSessionEvent } from '../normalization-session-event/normalization-session-event';
import { NormalizationSessionEventDb } from '../normalization-session-event/normalization-session-event-db';
import { NormalizationSessionEventEntity } from '../normalization-session-event/normalization-session-event-entity';
import { NormalizationSessionEventId } from '../normalization-session-event/normalization-session-event-id';
import { NormalizationSessionId } from '../normalization-session-id';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { NormalizationSessionProjectionDb } from '../normalization-session-projection/normalization-session-projection-db';
import { Artifact } from '~/src/artifacts/artifact';
import { ArtifactDb } from '~/src/artifacts/artifact-db';
import { ArtifactId } from '~/src/artifacts/artifact-id';
import { ResourceOwnershipEntity } from '~/src/permissions/resource-ownership-entity';
import { ResourceOwnershipEntityId } from '~/src/permissions/resource-ownership-entity-id';
import { getNormalizationSessionOwner } from '../normalization-session-permissions';
import { NormalizationSessionPayload } from '../normalization-session-payload/normalization-session-payload';

export const normalizationSessionEventRouter = router({
  /**
   * Append a new event to a normalization session
   */
  append: procedure
    .input(
      z.object({
        sessionId: NormalizationSessionId.schema,
        event: NormalizationSessionEvent.schema,
      }),
    )
    .output(NormalizationSessionPayload.schema)
    .mutation(async ({ input, ctx }) => {
      const eventId = NormalizationSessionEventId.generate();
      ctx.logger.info('Normalization session event append', {
        sessionId: input.sessionId,
        eventId,
        eventType: input.event.type,
        userId: ctx.userId,
      });
      const event: NormalizationSessionEventEntity = {
        id: eventId,
        normalization_session_id: input.sessionId,
        event: input.event,
        created_at: new Date(),
      };
      await ctx.db.transaction(async (tx) => {
        const projectionDb = new NormalizationSessionProjectionDb(tx, ctx.logger);
        const projectionBefore = await projectionDb.load(input.sessionId, ctx.userId);
        const eventDb = new NormalizationSessionEventDb(tx, ctx.logger);
        await eventDb.append(event);
        const projection = await projectionDb.refresh(input.sessionId, ctx.userId);
        if (
          NormalizationSessionProjection.shouldStartNormalizationJob(projectionBefore, projection)
        ) {
          await enqueueJob(tx, 'normalization', { sessionId: input.sessionId });
        }
      });
      // After commit, load full payload to return
      const ownerId = await getNormalizationSessionOwner(ctx.db, input.sessionId);
      if (!ownerId) {
        throw new Error('Normalization session not found');
      }
      const projectionDb = new NormalizationSessionProjectionDb(ctx.db, ctx.logger);
      const events = await projectionDb.loadEvents(input.sessionId);
      const projection = await projectionDb.load(input.sessionId, ownerId);

      // Collect all artifact IDs from the projection
      const artifactIds = new Set<string>();
      for (const artifactId of projection.targetArtifactIds) {
        artifactIds.add(artifactId);
      }
      for (const entry of projection.entries) {
        for (const artifactId of entry.inputArtifactIds) {
          artifactIds.add(artifactId);
        }
        for (const artifactId of entry.outputArtifactIds) {
          artifactIds.add(artifactId);
        }
      }

      let artifacts: Artifact[] = [];
      if (artifactIds.size > 0) {
        const artifactDb = new ArtifactDb(ctx.db, ctx.logger);
        artifacts = await artifactDb.getByIds(Array.from(artifactIds) as ArtifactId[]);
        artifacts = await artifactDb.refreshUrls({
          artifacts,
          s3: ctx.s3,
          s3Endpoint: ctx.s3Endpoint,
        });
      }

      const resourceOwnership: ResourceOwnershipEntity[] = [
        {
          id: ResourceOwnershipEntityId.create('normalization-session', input.sessionId),
          resourceType: 'normalization-session',
          resourceId: input.sessionId,
          ownerId,
        },
      ];

      const payload: NormalizationSessionPayload = {
        events,
        projections: [projection],
        artifacts,
        resourceOwnership,
      };

      return payload;
    }),
});
