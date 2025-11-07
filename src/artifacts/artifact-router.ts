import { eq } from 'drizzle-orm';
import { z } from 'zod';
import * as schema from '../db/schema';
import { procedure, router } from '../lib/trpc-server';
import { getS3Config } from '../s3-config';
import { ArtifactId } from './artifact-id';

export const artifactRouter = router({
  // Get presigned upload URL (mutation because it creates DB record)
  startUpload: procedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const id = ArtifactId.generate();
      const s3Key = `artifacts/${id}/${input.filename}`;
      const { s3Bucket } = getS3Config();

      const expiresIn = 60 * 60 * 24 * 30; // 30 days

      // Generate presigned URL with S3 client
      const uploadUrl = ctx.s3
        .file(s3Key, {
          bucket: s3Bucket,
        })
        .presign({
          expiresIn: expiresIn,
        });

      // Insert directly into database
      await ctx.db.insert(schema.artifacts).values({
        id,
        filename: input.filename,
        content_type: input.contentType,
        size: 0,
        file_type: input.filename.split('.').pop() || 'unknown',
        status: 'pending',
        s3_bucket: s3Bucket,
        s3_key: s3Key,
        created_at: new Date(),
        updated_at: new Date(),
        upload_url: uploadUrl,
        upload_url_expires_at: new Date(Date.now() + expiresIn * 1000),
      });

      return {
        fileId: id,
      };
    }),

  // Mark file as uploaded
  finish: procedure
    .input(
      z.object({
        key: z.string(),
        size: z.number(),
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
        .where(eq(schema.artifacts.id, input.key));
    }),

  get: procedure
    .input(
      z.object({
        key: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const file = await ctx.db
        .select()
        .from(schema.artifacts)
        .where(eq(schema.artifacts.id, input.key))
        .limit(1)
        .then((rows) => rows[0]);
      return file;
    }),

  // List files for user
  list: procedure.query(async ({ ctx }) => {
    // You may want to filter by user or other logic in a real app
    const files = await ctx.db.select().from(schema.artifacts).orderBy(schema.artifacts.created_at);
    return files;
  }),
});
