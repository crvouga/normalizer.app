import { and, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../db/schema';
import { procedure, router } from '../lib/trpc-server';
import { Artifact } from './artifact';
import { artifactUploadRouter } from './artifact-upload/artifact-upload-router';
import { editArtifactRouter } from './edit-artifact/edit-artifact-router';
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
      const artifact = await ctx.db
        .select()
        .from(schema.artifacts)
        .where(and(eq(schema.artifacts.id, input.artifactId), isNull(schema.artifacts.deleted)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!artifact) {
        return null;
      }

      // Validate and transform to Artifact type
      const validatedArtifact = Artifact.schema.parse(artifact);

      // Populate URLs and get update metadata
      const {
        artifacts: [artifactWithUrls],
        updated,
      } = await Artifact.populateUrls([validatedArtifact], ctx.s3);

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
      // Only select artifacts that are uploaded and not deleted
      const files = await ctx.db
        .select()
        .from(schema.artifacts)
        .where(and(eq(schema.artifacts.status, 'uploaded'), isNull(schema.artifacts.deleted)))
        .orderBy(schema.artifacts.created_at);

      // Validate and transform to Artifact type array
      const validatedArtifacts = z.array(Artifact.schema).parse(files);

      // Populate URLs and get update metadata
      const { artifacts: artifactsWithUrls, updated } = await Artifact.populateUrls(
        validatedArtifacts,
        ctx.s3,
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
