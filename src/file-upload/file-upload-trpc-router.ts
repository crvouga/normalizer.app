import { randomUUID } from 'crypto';
import { z } from 'zod';
import { procedure, router } from '../lib/trpc-server';
import { getS3Config } from '../s3-config';

// Types for file metadata
const FileMetadata = z.object({
  id: z.string(),
  filename: z.string(),
  content_type: z.string(),
  size: z.number(),
  file_type: z.string(),
  status: z.string(),
  s3_bucket: z.string(),
  s3_key: z.string(),
});

export type FileMetadata = z.infer<typeof FileMetadata>;

// Create router
export const createFileUploadRouter = () =>
  router({
    // Get presigned upload URL (mutation because it creates DB record)
    getUploadUrl: procedure
      .input(
        z.object({
          filename: z.string(),
          contentType: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const id = randomUUID();
        const s3Key = `uploads/${id}/${input.filename}`;
        const { s3Bucket, s3Endpoint } = getS3Config();

        // Generate presigned URL with S3 client
        const uploadUrl = ctx.s3
          .file(s3Key, {
            bucket: s3Bucket,
          })
          .presign({
            expiresIn: 60 * 60 * 24 * 30, // 30 days
          });

        // Create file record
        const fileData: FileMetadata = {
          id,
          filename: input.filename,
          content_type: input.contentType,
          size: 0, // Will be updated after upload
          file_type: input.filename.split('.').pop() || 'unknown',
          status: 'pending',
          s3_bucket: s3Bucket,
          s3_key: s3Key,
        };

        // Insert into database
        await ctx.sql`
          INSERT INTO files (id, data)
          VALUES (${id}, ${JSON.stringify(fileData)}::jsonb)
        `;

        return {
          uploadUrl,
          fileId: id,
        };
      }),

    // Get file metadata
    getFile: procedure
      .input(
        z.object({
          key: z.string(),
        }),
      )
      .query(async ({ input, ctx }) => {
        const result = await ctx.sql`
          SELECT data FROM files 
          WHERE id = ${input.key}
          LIMIT 1
        `;
        return result[0]?.data || null;
      }),

    // List files for user
    listFiles: procedure.query(async ({ ctx }) => {
      const results = await ctx.sql`
        SELECT data FROM files
        ORDER BY id DESC
      `;
      return results.map((r) => r.data as FileMetadata);
    }),

    // Mark file as uploaded
    markUploaded: procedure
      .input(
        z.object({
          key: z.string(),
          size: z.number(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const result = await ctx.sql`
          UPDATE files
          SET data = jsonb_set(
            jsonb_set(
              data,
              '{status}',
              '"uploaded"'::jsonb
            ),
            '{size}',
            ${input.size}::text::jsonb
          )
          WHERE id = ${input.key}
          RETURNING data
        `;

        if (!result.length) {
          throw new Error('File not found');
        }
      }),

    // Delete file
    deleteFile: procedure
      .input(
        z.object({
          key: z.string(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const file = await ctx.sql`
          SELECT data FROM files
          WHERE id = ${input.key}
          LIMIT 1
        `;

        if (!file[0]) {
          throw new Error('File not found');
        }

        const fileData = file[0].data as FileMetadata;

        // Delete from S3
        await ctx.s3
          .file(fileData.s3_key, {
            bucket: fileData.s3_bucket,
          })
          .delete();

        // Delete from database
        await ctx.sql`
          DELETE FROM files
          WHERE id = ${input.key}
        `;
      }),
  });
