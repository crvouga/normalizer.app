import { ArtifactId } from './artifact-id';
import type { Artifact as ArtifactType } from './artifact-type';
import { artifactSchema } from './artifact-type';

export type Artifact = ArtifactType;

const create = (input: {
  id: ArtifactId;
  filename: string;
  content_type: string;
  name?: string;
}): Artifact => {
  return {
    id: input.id,
    filename: input.filename,
    content_type: input.content_type,
    size: 0,
    file_type: input.filename.split('.').pop() || 'unknown',
    status: 'pending',
    s3_bucket: '',
    s3_key: '',
    created_at: new Date(),
    updated_at: new Date(),
    uploaded_by_user_id: null,
    upload_ip: null,
    sha256: null,
    download_url: null,
    download_url_expires_at: null,
    upload_url: null,
    upload_url_expires_at: null,
    name: input.name ?? null,
    tags: null,
    description: null,
    deleted: null,
  };
};

export const Artifact = {
  schema: artifactSchema,
  create,
};
