import { and, desc, inArray, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { refreshArtifactUrls } from '~/src/artifacts/artifact-urls-refresh';
import { Artifact } from '../../artifacts/artifact';
import * as schema from '../../db/schema';
import { procedure, router } from '../../lib/trpc-server';
import { UserId } from '../../users/user-id';
import { NormalizationSessionProjection } from '../normalization-session-projection/normalization-session-projection';
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
      const conditions = [
        sql`COALESCE(
          ${schema.normalizationSessionProjections.projection}->>'startedByUserId',
          (${schema.normalizationSessionProjections.projection}#>>'{}')::jsonb->>'startedByUserId'
        ) = ${input.userId}`,
      ];
      if (input.cursor) {
        conditions.push(
          lt(schema.normalizationSessionProjections.updated_at, new Date(input.cursor)),
        );
      }

      const query = ctx.db
        .select()
        .from(schema.normalizationSessionProjections)
        .where(and(...conditions))
        .orderBy(desc(schema.normalizationSessionProjections.updated_at))
        .limit(input.limit + 1);

      const rows = await query;
      const sessionProjections = rows
        .slice(0, input.limit)
        .map((row) => NormalizationSessionProjection.schema.parse(row.projection));

      const hasMore = rows.length > input.limit;
      const lastRow = rows[input.limit - 1];
      const nextCursor = hasMore && lastRow?.updated_at ? lastRow.updated_at.toISOString() : null;

      const artifactIds = Array.from(
        new Set(sessionProjections.flatMap((projection) => projection.targetArtifactIds)),
      );

      let artifacts: Artifact[] = [];
      if (artifactIds.length > 0) {
        const artifactRows = await ctx.db
          .select()
          .from(schema.artifacts)
          .where(and(inArray(schema.artifacts.id, artifactIds), isNull(schema.artifacts.deleted)));

        artifacts = artifactRows.map((row) => Artifact.schema.parse(row));
        artifacts = await refreshArtifactUrls({ ...ctx, artifacts });
      }

      const resourceOwnerships: ResourceOwnershipEntity[] = sessionProjections.map(
        (projection) => ({
          id: ResourceOwnershipEntityId.create('normalization-session', projection.id),
          resourceType: 'normalization-session',
          resourceId: projection.id,
          ownerId: projection.startedByUserId,
        }),
      );

      return {
        sessions: sessionProjections,
        artifacts,
        resourceOwnerships,
        nextCursor,
        hasMore,
      };
    }),
});
