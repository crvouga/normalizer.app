import { z } from 'zod';

// Types for file metadata
export const FileUploadRecord = z.object({
  id: z.string(),
  filename: z.string(),
  content_type: z.string(),
  size: z.number(),
  file_type: z.string(),
  status: z.string(),
  s3_bucket: z.string(),
  s3_key: z.string(),

  // Common extra metadata:
  created_at: z.string().datetime().or(z.date()).optional(), // When the record was created
  updated_at: z.string().datetime().or(z.date()).optional(), // When last updated

  // Upload metadata
  uploader: z.string().optional(), // Who uploaded the file (user id, etc.)
  upload_ip: z.string().optional(), // Where the upload came from

  // File info
  sha256: z.string().optional(), // Optional file hash for integrity/check
  download_url: z.string().url().optional(), // Direct download URL if available

  // Application/domain-specific
  tags: z.array(z.string()).optional(), // Any tags assigned to the file
  description: z.string().optional(), // Human-readable description

  // Soft delete marker
  deleted: z.boolean().optional(), // If the file was deleted (soft delete)
});

export type IFileUploadRecord = z.infer<typeof FileUploadRecord>;
