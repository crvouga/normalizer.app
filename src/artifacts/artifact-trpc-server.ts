import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../db/schema';
import { procedure, router } from '../lib/trpc-server';
import { Artifact } from './artifact';
import { artifactUploadRouter } from './artifact-upload/artifact-upload-trpc-server';
import { editArtifactRouter } from './edit-artifact/edit-artifact-trpc-server';
import { ArtifactId } from './artifact-id';

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
    .mutation(async ({ input, ctx }) => {
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

      // Populate URLs and get update metadata
      const {
        artifacts: [artifactWithUrls],
        updated,
      } = await Artifact.populateUrls([validatedArtifact], ctx.s3, ctx.s3Endpoint);

      // If URLs were updated, persist to database
      if (updated.has(String(validatedArtifact.id))) {
        await ctx.db
          .update(schema.artifacts)
          .set({
            upload_url: artifactWithUrls.upload_url,
            upload_url_expires_at: artifactWithUrls.upload_url_expires_at,
            download_url: artifactWithUrls.download_url,
            download_url_expires_at: artifactWithUrls.download_url_expires_at,
            updated_at: new Date(),
          })
          .where(eq(schema.artifacts.id, input.artifactId));
      }

      return artifactWithUrls;
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

      // Populate URLs and get update metadata
      const { artifacts: artifactsWithUrls, updated } = await Artifact.populateUrls(
        validatedArtifacts,
        ctx.s3,
        ctx.s3Endpoint,
      );

      // Update database for artifacts with refreshed URLs
      if (updated.size > 0) {
        await Promise.all(
          artifactsWithUrls
            .filter((artifact) => updated.has(String(artifact.id)))
            .map((artifact) =>
              ctx.db
                .update(schema.artifacts)
                .set({
                  upload_url: artifact.upload_url,
                  upload_url_expires_at: artifact.upload_url_expires_at,
                  download_url: artifact.download_url,
                  download_url_expires_at: artifact.download_url_expires_at,
                  updated_at: new Date(),
                })
                .where(eq(schema.artifacts.id, String(artifact.id))),
            ),
        );
      }

      return artifactsWithUrls;
    }),
});
