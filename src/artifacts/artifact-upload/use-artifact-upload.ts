import { useMemo, useState } from 'react';
import type { RemoteResult, Result } from '../../lib/result';
import { Err, Failure, Loading, NotAsked, Ok, Success } from '../../lib/result';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../trpc-client';
import { Artifact } from '../artifact';
import { ArtifactId } from '../artifact-id';

export function useArtifactUpload({
  onUploadComplete,
}: {
  onUploadComplete?: (artifact: Result<Artifact, Error>) => void;
}) {
  const [state, setState] = useState<RemoteResult<Artifact, Error>>(NotAsked);
  const entityStore = useEntityStore();

  const uploadArtifact = async (file: File) => {
    setState(Loading);

    // Generate client-side artifact ID
    const artifactId = ArtifactId.generate();

    try {
      // Create optimistic artifact entity with pending status
      const optimisticArtifact = Artifact.create({
        id: artifactId,
        filename: file.name,
        content_type: file.type,
      });

      // Optimistically insert into entity store
      entityStore.addEntity('artifacts', optimisticArtifact);

      // Get presigned URL
      await trpcClient.artifact.upload.start.mutate({
        filename: file.name,
        contentType: file.type,
        artifactId,
      });

      // If server ID differs from client ID, update the entity
      if (artifactId !== artifactId) {
        // Remove the optimistic entity
        entityStore.removeEntity('artifacts', artifactId);
      }

      const before: Artifact | null = await trpcClient.artifact.get.mutate({
        artifactId: artifactId,
      });

      if (!before?.upload_url) {
        throw new Error('Failed to get upload URL');
      }

      // Add or update with server data
      entityStore.addEntity('artifacts', before);

      // Upload to S3
      const response = await fetch(before.upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // Mark as uploaded in database
      await trpcClient.artifact.upload.finish.mutate({
        key: artifactId,
        size: file.size,
        artifactId,
      });

      // Fetch updated artifact
      const artifact: Artifact | null = await trpcClient.artifact.get.mutate({
        artifactId: artifactId,
      });

      if (!artifact) {
        throw new Error('Failed to fetch file after upload');
      }

      // Update entity store with uploaded status
      entityStore.updateEntity('artifacts', artifactId, {
        status: 'uploaded',
        size: file.size,
        updated_at: artifact.updated_at,
      });

      setState(Success(artifact));
      onUploadComplete?.(Ok(artifact));
    } catch (error) {
      // Remove the optimistic entity on error
      entityStore.removeEntity('artifacts', artifactId);

      setState(Failure(error as Error));
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
