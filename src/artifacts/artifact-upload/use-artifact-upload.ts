import { useMemo, useState } from 'react';
import type { RemoteResult, Result } from '../../lib/result';
import { Err, Failure, Loading, NotAsked, Ok, Success } from '../../lib/result';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../trpc-client';
import { showErrorToast, showSuccessToast } from '../../ui/toast';
import { useI18n } from '../../i18n/use-i18n';
import { Artifact } from '../artifact';
import { ArtifactId } from '../artifact-id';

export function useArtifactUpload({
  onUploadComplete,
}: {
  onUploadComplete?: (artifact: Result<Artifact, Error>) => void;
}) {
  const [state, setState] = useState<RemoteResult<Artifact, Error>>(NotAsked);
  const entityStore = useEntityStore();
  const { t } = useI18n();

  const uploadArtifact = async (file: File, name?: string) => {
    setState(Loading);

    const artifactId = ArtifactId.generate();

    try {
      const optimisticArtifact = Artifact.create({
        id: artifactId,
        filename: file.name,
        content_type: file.type,
        ...(name ? { name } : {}),
      });

      entityStore.addEntity('artifacts', optimisticArtifact);

      await trpcClient.artifact.upload.start.mutate({
        filename: file.name,
        contentType: file.type,
        artifactId,
        name,
      });

      if (artifactId !== artifactId) {
        entityStore.removeEntity('artifacts', artifactId);
      }

      const before = await trpcClient.artifact.get.mutate({
        artifactId: artifactId,
      });

      if (!before?.upload_url) {
        throw new Error('Failed to get upload URL');
      }

      entityStore.addEntity('artifacts', {
        ...before,
        created_at: before.created_at ? new Date(before.created_at) : null,
        updated_at: before.updated_at ? new Date(before.updated_at) : null,
        download_url_expires_at: before.download_url_expires_at
          ? new Date(before.download_url_expires_at)
          : null,
        upload_url_expires_at: before.upload_url_expires_at
          ? new Date(before.upload_url_expires_at)
          : null,
      });

      const uploadUrl = new URL(before.upload_url);
      uploadUrl.protocol = window.location.protocol;

      const response = await fetch(uploadUrl.toString(), {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to upload file to S3');
      }

      await trpcClient.artifact.upload.finish.mutate({
        key: artifactId,
        size: file.size,
        artifactId,
      });

      const rawArtifact: any = await trpcClient.artifact.get.mutate({ artifactId });

      if (!rawArtifact) {
        throw new Error('Failed to fetch file after upload');
      }

      const artifact = Artifact.schema.parse(rawArtifact);

      entityStore.addEntity('artifacts', artifact);

      setState(Success(artifact));
      showSuccessToast(t('artifact.uploadSuccess'));
      onUploadComplete?.(Ok(artifact));
    } catch (error) {
      entityStore.removeEntity('artifacts', artifactId);

      setState(Failure(error as Error));
      showErrorToast(t('artifact.uploadError'), error);
      onUploadComplete?.(Err(error as Error));
    }
  };

  const isUploading = useMemo(() => state.tag === 'loading', [state]);

  return {
    uploadArtifact,
    state,
    isUploading,
  };
}
