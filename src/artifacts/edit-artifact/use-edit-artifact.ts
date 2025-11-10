import { useMemo, useState } from 'react';
import type { RemoteResult, Result } from '../../lib/result';
import { Err, Failure, Loading, NotAsked, Ok, Success } from '../../lib/result';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../trpc-client';
import { Artifact } from '../artifact';
import { ArtifactId } from '../artifact-id';

export interface EditArtifactParams {
  artifactId: ArtifactId;
  name?: string;
}

export function useEditArtifact({
  onEditComplete,
}: {
  onEditComplete?: (artifact: Result<Artifact, Error>) => void;
}) {
  const [state, setState] = useState<RemoteResult<Artifact, Error>>(NotAsked);
  const entityStore = useEntityStore();

  const editArtifact = async (params: EditArtifactParams) => {
    setState(Loading);

    try {
      // Optimistically update the entity store
      entityStore.updateEntity('artifacts', params.artifactId, {
        name: params.name,
        updated_at: new Date(),
      });

      // Call the backend to update the artifact
      const updatedArtifact = await trpcClient.artifact.edit.update.mutate({
        artifactId: params.artifactId,
        name: params.name,
      });

      // Update entity store with server response
      entityStore.updateEntity('artifacts', params.artifactId, updatedArtifact);

      setState(Success(updatedArtifact));
      onEditComplete?.(Ok(updatedArtifact));
    } catch (error) {
      // Revert optimistic update by fetching fresh data
      try {
        const artifact = await trpcClient.artifact.get.mutate({
          artifactId: params.artifactId,
        });
        if (artifact) {
          entityStore.updateEntity('artifacts', params.artifactId, artifact);
        }
      } catch {
        // If we can't revert, just leave the optimistic update
      }

      setState(Failure(error as Error));
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
