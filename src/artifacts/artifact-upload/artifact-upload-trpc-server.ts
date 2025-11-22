import { z } from 'zod';
import { procedure, router } from '../../shared/trpc-server';
import { getS3Config } from '../../shared/s3-config';
import { ArtifactId } from '../artifact-id';
import { ArtifactDb } from '../artifact-db';

export const artifactUploadRouter = router({
  // Get presigned upload URL (mutation because it creates DB record)
  start: procedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        artifactId: ArtifactId.schema,
        name: z.string().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const { artifactId } = input;
      const s3Key = `artifacts/${artifactId}/${input.filename}`;
      const { s3Bucket } = getS3Config();

      ctx.logger.info('Artifact upload start', {
        artifactId,
        userId: ctx.userId,
        sessionId: ctx.sessionId,
      });

      const artifactDb = new ArtifactDb(ctx.db, ctx.logger);
      await artifactDb.create({
        id: artifactId,
        filename: input.filename,
        content_type: input.contentType,
        size: 0,
        file_type: input.filename.split('.').pop() || 'unknown',
        status: 'pending',
        object_bucket: s3Bucket,
        object_key: s3Key,
        name: input.name ?? null,
        uploaded_by_user_id: ctx.userId,
        uploaded_by: 'user',
      });

      return {
        artifactId,
      };
    }),

  finish: procedure
    .input(
      z.object({
        key: z.string(),
        size: z.number(),
        artifactId: ArtifactId.schema,
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const artifactDb = new ArtifactDb(ctx.db, ctx.logger);
      await artifactDb.updateStatus(input.artifactId, 'uploaded', input.size);
    }),
});
