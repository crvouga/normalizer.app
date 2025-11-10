import { eq } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../../db/schema';
import { procedure, router } from '../../lib/trpc-server';
import { getS3Config } from '../../s3-config';
import { ArtifactId } from '../artifact-id';

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

      await ctx.db.insert(schema.artifacts).values({
        id: artifactId,
        filename: input.filename,
        content_type: input.contentType,
        size: 0,
        file_type: input.filename.split('.').pop() || 'unknown',
        status: 'pending',
        s3_bucket: s3Bucket,
        s3_key: s3Key,
        name: input.name ?? null,
        created_at: new Date(),
        updated_at: new Date(),
        uploaded_by_user_id: ctx.userId,
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
      await ctx.db
        .update(schema.artifacts)
        .set({
          status: 'uploaded',
          size: input.size,
          updated_at: new Date(),
        })
        .where(eq(schema.artifacts.id, input.artifactId));
    }),
});
