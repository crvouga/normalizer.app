import { useMemo, useState } from 'react';
import type { Artifact } from './artifact';
import type { RemoteResult } from '../lib/result';
import { Failure, Loading, NotAsked, Success } from '../lib/result';
import { trpcClient } from '../trpc-client';

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
    try {
      // Get presigned URL
      const { fileId } = await trpcClient.artifact.startUpload.mutate({
        filename: file.name,
        contentType: file.type,
      });

      const before: Artifact | null = await trpcClient.artifact.get.query({
        key: fileId,
      });

      if (!before?.upload_url) {
        throw new Error('Failed to get upload URL');
      }

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
      await trpcClient.artifact.finish.mutate({
        key: fileId,
        size: file.size,
      });

      // Invalidate and refetch file data
      const artifact: Artifact | null = await trpcClient.artifact.get.query({
        key: fileId,
      });

      setUploadProgress(100);

      if (!artifact) {
        throw new Error('Failed to fetch file after upload');
      }

      // The artifact is already properly typed from the router
      setUploadState(Success(artifact));
      onUploadComplete?.(artifact);
    } catch (error) {
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
