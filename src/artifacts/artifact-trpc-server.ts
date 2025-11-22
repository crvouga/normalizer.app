import { z } from 'zod';
import { procedure, router } from '../shared/trpc-server';
import { Artifact } from './artifact';
import { ArtifactId } from './artifact-id';
import { artifactUploadRouter } from './artifact-upload/artifact-upload-trpc-server';
import { editArtifactRouter } from './edit-artifact/edit-artifact-trpc-server';
import { ArtifactDb } from './artifact-db';

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

      const artifactDb = new ArtifactDb(ctx.db, ctx.logger);
      const artifact = await artifactDb.getById(input.artifactId);

      if (!artifact) {
        ctx.logger.info('Artifact not found', { artifactId: input.artifactId });
        return null;
      }

      ctx.logger.info('Artifact found', {
        artifactId: input.artifactId,
        uploadedByUserId: artifact.uploaded_by_user_id,
      });

      const artifactsWithUrls = await artifactDb.refreshUrls({
        artifacts: [artifact],
        objectStore: ctx.objectStore,
      });

      return artifactsWithUrls[0] ?? null;
    }),

  listByUser: procedure
    .output(z.array(Artifact.schema))
    .mutation(async ({ ctx }): Promise<Artifact[]> => {
      ctx.logger.info('Artifact list', {
        userId: ctx.userId,
        sessionId: ctx.sessionId,
      });

      const artifactDb = new ArtifactDb(ctx.db, ctx.logger);
      const artifacts = await artifactDb.listByUser(ctx.userId);

      ctx.logger.info('Artifact list result', { count: artifacts.length });

      const artifactsWithUrls = await artifactDb.refreshUrls({
        artifacts,
        objectStore: ctx.objectStore,
      });

      return artifactsWithUrls;
    }),
});
