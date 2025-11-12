import { z } from 'zod';
import { ArtifactId } from './artifact-id';

/**
 * Zod schema for the Artifact entity, matching the database schema.
 */
export const artifactSchema = z.object({
  id: ArtifactId.schema,
  filename: z.string(),
  content_type: z.string(),
  size: z.number().int(),
  file_type: z.string(),
  status: z.enum(['pending', 'uploaded']),
  s3_bucket: z.string(),
  s3_key: z.string(),

  created_at: z.coerce.date().nullable().optional(),
  updated_at: z.coerce.date().nullable().optional(),

  uploaded_by_user_id: z.string().nullable().optional(),
  upload_ip: z.string().nullable().optional(),

  sha256: z.string().nullable().optional(),
  download_url: z.string().nullable().optional(),
  download_url_expires_at: z.coerce.date().nullable().optional(),

  upload_url: z.string().nullable().optional(),
  upload_url_expires_at: z.coerce.date().nullable().optional(),

  name: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().nullable(),
  description: z.string().nullable().optional(),

  deleted: z.boolean().nullable().optional(),
});

export type Artifact = z.infer<typeof artifactSchema>;
