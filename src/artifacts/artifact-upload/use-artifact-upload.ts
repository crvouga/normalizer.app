import { useMemo, useState } from 'react';
import type { RemoteResult } from '../../lib/result';
import { Failure, Loading, NotAsked, Success } from '../../lib/result';
import { useEntityStore } from '../../store/entity-store';
import { trpcClient } from '../../trpc-client';
import { Artifact } from '../artifact';
import { ArtifactId } from '../artifact-id';

export function useArtifactUpload({
  onUploadComplete,
  onUploadError,
}: {
  onUploadComplete?: (artifact: Artifact) => void;
  onUploadError?: (error: Error) => void;
}) {
  // Use RemoteResult for the main upload state
  const [uploadState, setUploadState] = useState<RemoteResult<Artifact, Error>>(NotAsked);
  const [uploadProgress, setUploadProgress] = useState(0);
  const entityStore = useEntityStore();

  const uploadFile = async (file: File) => {
    setUploadState(Loading);
    setUploadProgress(0);

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
      await trpcClient.artifactUpload.start.mutate({
        filename: file.name,
        contentType: file.type,
        artifactId,
      });

      // If server ID differs from client ID, update the entity
      if (artifactId !== artifactId) {
        // Remove the optimistic entity
        entityStore.removeEntity('artifacts', artifactId);
      }

      const before: Artifact | null = await trpcClient.artifact.get.query({
        key: artifactId,
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
      await trpcClient.artifactUpload.finish.mutate({
        key: artifactId,
        size: file.size,
      });

      // Fetch updated artifact
      const artifact: Artifact | null = await trpcClient.artifact.get.query({
        key: artifactId,
      });

      setUploadProgress(100);

      if (!artifact) {
        throw new Error('Failed to fetch file after upload');
      }

      // Update entity store with uploaded status
      entityStore.updateEntity('artifacts', artifactId as ArtifactId, {
        status: 'uploaded',
        size: file.size,
        updated_at: artifact.updated_at,
      });

      setUploadState(Success(artifact));
      onUploadComplete?.(artifact);
    } catch (error) {
      // Remove the optimistic entity on error
      entityStore.removeEntity('artifacts', artifactId);

      setUploadState(Failure(error as Error));
      onUploadError?.(error as Error);
    }
  };

  const isUploading = useMemo(() => uploadState.tag === 'loading', [uploadState]);

  return {
    uploadFile,
    uploadState,
    uploadProgress,
    isUploading,
  };
}
