import { useMemo, useState } from 'react';
import type { RemoteResult, Result } from '../../lib/result';
import { Err, Failure, Loading, NotAsked, Ok, Success } from '../../lib/result';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../shared/trpc-client';
import { showErrorToast, showSuccessToast } from '../../ui/toast';
import { useI18n } from '../../i18n/use-i18n';
import { Artifact } from '../artifact';
import { ArtifactId } from '../artifact-id';

export interface EditArtifactParams {
  artifactId: ArtifactId;
  name?: string;
  filename?: string;
}

export function useEditArtifact({
  onEditComplete,
}: {
  onEditComplete?: (artifact: Result<Artifact, Error>) => void;
}) {
  const [state, setState] = useState<RemoteResult<Artifact, Error>>(NotAsked);
  const entityStore = useEntityStore();
  const { t } = useI18n();

  const editArtifact = async (params: EditArtifactParams) => {
    setState(Loading);

    try {
      // Call the backend to update the artifact
      const rawUpdatedArtifact: any = await trpcClient.artifact.edit.update.mutate({
        artifactId: params.artifactId,
        name: params.name,
        filename: params.filename,
      });

      // Convert date strings to Date objects
      const updatedArtifact: Artifact = {
        ...rawUpdatedArtifact,
        created_at: rawUpdatedArtifact.created_at ? new Date(rawUpdatedArtifact.created_at) : null,
        updated_at: rawUpdatedArtifact.updated_at ? new Date(rawUpdatedArtifact.updated_at) : null,
        download_url_expires_at: rawUpdatedArtifact.download_url_expires_at
          ? new Date(rawUpdatedArtifact.download_url_expires_at)
          : null,
        upload_url_expires_at: rawUpdatedArtifact.upload_url_expires_at
          ? new Date(rawUpdatedArtifact.upload_url_expires_at)
          : null,
      };

      // Update entity store with server response
      entityStore.addEntity('artifacts', updatedArtifact);

      setState(Success(updatedArtifact));
      showSuccessToast(t('artifact.editSuccess'));
      onEditComplete?.(Ok(updatedArtifact));
    } catch (error) {
      // Revert optimistic update by fetching fresh data
      try {
        const rawArtifact: any = await trpcClient.artifact.get.mutate({
          artifactId: params.artifactId,
        });
        if (rawArtifact) {
          // Convert date strings to Date objects
          const artifact: Artifact = {
            ...rawArtifact,
            created_at: rawArtifact.created_at ? new Date(rawArtifact.created_at) : null,
            updated_at: rawArtifact.updated_at ? new Date(rawArtifact.updated_at) : null,
            download_url_expires_at: rawArtifact.download_url_expires_at
              ? new Date(rawArtifact.download_url_expires_at)
              : null,
            upload_url_expires_at: rawArtifact.upload_url_expires_at
              ? new Date(rawArtifact.upload_url_expires_at)
              : null,
          };
          entityStore.addEntity('artifacts', artifact);
        }
      } catch {
        // If we can't revert, just leave the optimistic update
      }

      setState(Failure(error as Error));
      showErrorToast(t('artifact.editError'), error);
      onEditComplete?.(Err(error as Error));
    }
  };

  const isEditing = useMemo(() => state.tag === 'loading', [state]);

  return {
    editArtifact,
    state,
    isEditing,
  };
}
