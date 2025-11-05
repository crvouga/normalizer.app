import { randomUUID } from 'crypto';
import { z } from 'zod';
import { procedure, router } from '../lib/trpc-server';
import { getS3Config } from '../s3-config';
import type { IFileUploadRecord } from './file-upload-record';
import { FileUploadRecordDb } from './file-upload-record-db';

// Create router
export const fileUploadRouter = router({
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
      const { s3Bucket } = getS3Config();

      // Generate presigned URL with S3 client
      const uploadUrl = ctx.s3
        .file(s3Key, {
          bucket: s3Bucket,
        })
        .presign({
          expiresIn: 60 * 60 * 24 * 30, // 30 days
        });

      // Create file record
      const fileData: IFileUploadRecord = {
        id,
        filename: input.filename,
        content_type: input.contentType,
        size: 0, // Will be updated after upload
        file_type: input.filename.split('.').pop() || 'unknown',
        status: 'pending',
        s3_bucket: s3Bucket,
        s3_key: s3Key,
      };

      // Insert into database via FileUploadRecordDb
      const fileDb = new FileUploadRecordDb(ctx);
      await fileDb.add(fileData);

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
      const fileDb = new FileUploadRecordDb(ctx);
      const data = await fileDb.get(input.key);
      return data;
    }),

  // List files for user
  listFiles: procedure.query(async ({ ctx }) => {
    const fileDb = new FileUploadRecordDb(ctx);
    return fileDb.getAll();
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
      const fileDb = new FileUploadRecordDb(ctx);
      await fileDb.updateAsUploaded(input.key, input.size);
    }),

  // Delete file
  deleteFile: procedure
    .input(
      z.object({
        key: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const fileDb = new FileUploadRecordDb(ctx);
      const fileData = await fileDb.get(input.key);

      if (!fileData) {
        throw new Error('File not found');
      }

      // Delete from S3
      await ctx.s3
        .file(fileData.s3_key, {
          bucket: fileData.s3_bucket,
        })
        .delete();

      // Delete from database
      await fileDb.remove(input.key);
    }),
});
