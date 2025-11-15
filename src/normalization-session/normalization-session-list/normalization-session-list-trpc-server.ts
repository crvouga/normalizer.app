import { z } from 'zod';
import { Artifact } from '../../artifacts/artifact';
import { ArtifactDb } from '../../artifacts/artifact-db';
import { procedure, router } from '../../shared/trpc-server';
import { UserId } from '../../users/user-id';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
import { NormalizationSessionProjectionDb } from '../normalization-session-projection/normalization-session-projection-db';
import { ResourceOwnershipEntity } from '../../permissions/resource-ownership-entity';
import { ResourceOwnershipEntityId } from '../../permissions/resource-ownership-entity-id';

const InputSchema = z.object({
  userId: UserId.schema,
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});
type InputSchema = z.infer<typeof InputSchema>;

const OutputSchema = z.object({
  sessions: z.array(NormalizationSessionProjection.schema),
  artifacts: z.array(Artifact.schema),
  resourceOwnerships: z.array(ResourceOwnershipEntity.schema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
type OutputSchema = z.infer<typeof OutputSchema>;

export const normalizationSessionListRouter = router({
  listByStartedByUser: procedure
    .input(InputSchema)
    .output(OutputSchema)
    .mutation(async ({ input, ctx }): Promise<OutputSchema> => {
      const projectionDb = new NormalizationSessionProjectionDb(ctx.db, ctx.logger);
      const { sessions, hasMore, nextCursor } = await projectionDb.listByStartedByUser({
        userId: input.userId,
        ...(input.cursor && { cursor: input.cursor }),
        limit: input.limit,
      });

      const artifactIds = Array.from(
        new Set(sessions.flatMap((projection) => projection.targetArtifactIds)),
      );

      let artifacts: Artifact[] = [];
      if (artifactIds.length > 0) {
        const artifactDb = new ArtifactDb(ctx.db, ctx.logger);
        artifacts = await artifactDb.getByIds(artifactIds);
        artifacts = await artifactDb.refreshUrls({
          artifacts,
          s3: ctx.s3,
          s3Endpoint: ctx.s3Endpoint,
        });
      }

      const resourceOwnerships: ResourceOwnershipEntity[] = sessions.map((projection) => ({
        id: ResourceOwnershipEntityId.create('normalization-session', projection.id),
        resourceType: 'normalization-session',
        resourceId: projection.id,
        ownerId: projection.startedByUserId,
      }));

      return {
        sessions,
        artifacts,
        resourceOwnerships,
        nextCursor,
        hasMore,
      };
    }),
});
