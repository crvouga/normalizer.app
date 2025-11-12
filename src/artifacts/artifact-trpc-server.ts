import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../db/schema';
import { procedure, router } from '../lib/trpc-server';
import { Artifact } from './artifact';
import { ArtifactId } from './artifact-id';
import { artifactUploadRouter } from './artifact-upload/artifact-upload-trpc-server';
import { refreshArtifactUrls } from './artifact-urls-refresh';
import { editArtifactRouter } from './edit-artifact/edit-artifact-trpc-server';

export const artifactRouter = router({
  upload: artifactUploadRouter,
  edit: editArtifactRouter,
  get: procedure
    .input(
      z.object({
        artifactId: ArtifactId.schema,
      }),
    )
    .output(Artifact.schema.nullable())
    .mutation(async ({ input, ctx }): Promise<Artifact | null> => {
      ctx.logger.info('Artifact get', {
        artifactId: input.artifactId,
        userId: ctx.userId,
        sessionId: ctx.sessionId,
      });

      // For get operation, only filter by artifact ID and soft delete status
      // Having the artifact ID (UUID) is sufficient authorization
      const artifact = await ctx.db
        .select()
        .from(schema.artifacts)
        .where(and(eq(schema.artifacts.id, input.artifactId), isNull(schema.artifacts.deleted)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!artifact) {
        ctx.logger.info('Artifact not found', { artifactId: input.artifactId });
        return null;
      }

      ctx.logger.info('Artifact found', {
        artifactId: input.artifactId,
        uploadedByUserId: artifact.uploaded_by_user_id,
      });

      // Validate and transform to Artifact type
      const validatedArtifact = Artifact.schema.parse(artifact);

      // Refresh artifact URLs and persist to database if needed
      const artifactsWithUrls = await refreshArtifactUrls({
        ...ctx,
        artifacts: [validatedArtifact],
      });

      return artifactsWithUrls[0] ?? null;
    }),

  // List files for user
  list: procedure
    .output(z.array(Artifact.schema))
    .mutation(async ({ ctx }): Promise<Artifact[]> => {
      ctx.logger.info('Artifact list', {
        userId: ctx.userId,
        sessionId: ctx.sessionId,
      });

      // Only select artifacts that are uploaded and not deleted and belong to the current user
      const files = await ctx.db
        .select()
        .from(schema.artifacts)
        .where(
          and(
            eq(schema.artifacts.status, 'uploaded'),
            eq(schema.artifacts.uploaded_by_user_id, ctx.userId),
            isNull(schema.artifacts.deleted),
          ),
        )
        .orderBy(schema.artifacts.created_at);

      ctx.logger.info('Artifact list result', { count: files.length });

      // Validate and transform to Artifact type array
      const validatedArtifacts = z.array(Artifact.schema).parse(files);

      // Refresh artifact URLs and persist to database if needed
      const artifactsWithUrls = await refreshArtifactUrls({
        ...ctx,
        artifacts: validatedArtifacts,
      });

      return artifactsWithUrls;
    }),
});
