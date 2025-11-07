import { useMemo, useState } from 'react';
import type { Artifact } from '../artifact';
import { ArtifactId } from '../artifact-id';
import type { RemoteResult } from '../../lib/result';
import { Failure, Loading, NotAsked, Success } from '../../lib/result';
import { trpcClient } from '../../trpc-client';
import { dispatch } from '../../store/entity-store';

export const useArtifactUpload = ({
  onUploadComplete,
  onUploadError,
}: {
  onUploadComplete?: (artifact: Artifact) => void;
  onUploadError?: (error: Error) => void;
}) => {
  // Use RemoteResult for the main upload state
  const [uploadState, setUploadState] = useState<RemoteResult<Artifact, Error>>(NotAsked);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File) => {
    setUploadState(Loading);
    setUploadProgress(0);

    // Generate client-side artifact ID
    const clientId = ArtifactId.generate();

    try {
      // Create optimistic artifact entity with pending status
      const optimisticArtifact: Artifact = {
        id: clientId,
        filename: file.name,
        content_type: file.type,
        size: 0,
        file_type: file.name.split('.').pop() || 'unknown',
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
        tags: null,
        description: null,
        deleted: null,
      };

      // Optimistically insert into entity store
      dispatch({
        type: 'entity/ADD',
        entityType: 'artifacts',
        entity: optimisticArtifact,
      });

      // Get presigned URL
      const { fileId } = await trpcClient.artifactUpload.start.mutate({
        filename: file.name,
        contentType: file.type,
      });

      // If server ID differs from client ID, update the entity
      if (fileId !== clientId) {
        // Remove the optimistic entity
        dispatch({
          type: 'entity/REMOVE',
          entityType: 'artifacts',
          id: clientId,
        });
      }

      const before: Artifact | null = await trpcClient.artifact.get.query({
        key: fileId,
      });

      if (!before?.upload_url) {
        throw new Error('Failed to get upload URL');
      }

      // Add or update with server data
      dispatch({
        type: 'entity/ADD',
        entityType: 'artifacts',
        entity: before,
      });

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
        key: fileId,
        size: file.size,
      });

      // Fetch updated artifact
      const artifact: Artifact | null = await trpcClient.artifact.get.query({
        key: fileId,
      });

      setUploadProgress(100);

      if (!artifact) {
        throw new Error('Failed to fetch file after upload');
      }

      // Update entity store with uploaded status
      dispatch({
        type: 'entity/UPDATE',
        entityType: 'artifacts',
        id: fileId as ArtifactId,
        changes: {
          status: 'uploaded',
          size: file.size,
          updated_at: artifact.updated_at,
        },
      });

      setUploadState(Success(artifact));
      onUploadComplete?.(artifact);
    } catch (error) {
      // Remove the optimistic entity on error
      dispatch({
        type: 'entity/REMOVE',
        entityType: 'artifacts',
        id: clientId,
      });

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
};
