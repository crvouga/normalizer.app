import { z } from "zod";
import { router, publicProcedure } from "../lib/trpc";
import { SQL } from "bun";
import { randomUUID } from "crypto";
import { getS3Config } from "../s3-config";
import { type MinioClient } from "../lib/minio/minio-client";

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

// Create router with injected dependencies
export const createFileUploadRouter = ({
  sql,
  minioClient,
}: {
  sql: SQL;
  minioClient: MinioClient;
}) =>
  router({
    // Get presigned upload URL
    getUploadUrl: publicProcedure
      .input(
        z.object({
          filename: z.string(),
          contentType: z.string(),
        })
      )
      .output(
        z.object({
          uploadUrl: z.string(),
          fileId: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const id = randomUUID();
        const s3Key = `uploads/${id}/${input.filename}`;
        const { s3Bucket, s3ExternalEndpoint, s3Endpoint } = getS3Config();

        // Generate presigned URL with MinIO client
        const uploadUrl = await minioClient.generatePresignedUrl(
          s3Bucket,
          s3Key
        );

        // Replace internal endpoint with external endpoint if different
        const finalUploadUrl = uploadUrl.replace(
          s3Endpoint,
          s3ExternalEndpoint
        );

        // Create file record
        const fileData: FileMetadata = {
          id,
          filename: input.filename,
          content_type: input.contentType,
          size: 0, // Will be updated after upload
          file_type: input.filename.split(".").pop() || "unknown",
          status: "pending",
          s3_bucket: s3Bucket,
          s3_key: s3Key,
        };

        // Insert into database
        await sql`
          INSERT INTO files (id, data)
          VALUES (${id}, ${JSON.stringify(fileData)}::jsonb)
        `;

        return {
          uploadUrl: finalUploadUrl,
          fileId: id,
        };
      }),

    // Get file metadata
    getFile: publicProcedure
      .input(
        z.object({
          key: z.string(),
        })
      )
      .output(FileMetadata)
      .query(async ({ input }) => {
        const result = await sql`
          SELECT data FROM files 
          WHERE id = ${input.key}
          LIMIT 1
        `;
        return result[0]?.data as FileMetadata;
      }),

    // List files for user
    listFiles: publicProcedure
      .input(z.void())
      .output(z.array(FileMetadata))
      .query(async () => {
        const results = await sql`
          SELECT data FROM files
          ORDER BY id DESC
        `;
        return results.map((r) => r.data as FileMetadata);
      }),

    // Mark file as uploaded
    markUploaded: publicProcedure
      .input(
        z.object({
          key: z.string(),
          size: z.number(),
        })
      )
      .output(z.void())
      .mutation(async ({ input }) => {
        await sql`
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
        `;
      }),

    // Delete file
    deleteFile: publicProcedure
      .input(
        z.object({
          key: z.string(),
        })
      )
      .output(z.void())
      .mutation(async ({ input }) => {
        const file = await sql`
          SELECT data FROM files
          WHERE id = ${input.key}
          LIMIT 1
        `;

        if (!file[0]) {
          throw new Error("File not found");
        }

        const fileData = file[0].data as FileMetadata;

        // Delete from MinIO
        await minioClient.deleteObject(fileData.s3_bucket, fileData.s3_key);

        // Delete from database
        await sql`
          DELETE FROM files
          WHERE id = ${input.key}
        `;
      }),
  });
