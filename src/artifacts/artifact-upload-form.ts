import { useMemo, useState } from 'react';
import type { IArtifact } from '../db/schema';
import type { RemoteResult } from '../lib/result';
import { Failure, Loading, NotAsked, Success } from '../lib/result';
import { trpcClient } from '../trpc-client';

interface UseFileUploadOptions {
  onUploadComplete?: (artifact: IArtifact) => void;
  onUploadError?: (error: Error) => void;
}

export const useArtifactUploadForm = ({
  onUploadComplete,
  onUploadError,
}: UseFileUploadOptions) => {
  // Use RemoteResult for the main upload state
  const [uploadState, setUploadState] = useState<RemoteResult<IArtifact, Error>>(NotAsked);
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

      const fileUploadRecordBefore = await trpcClient.artifact.get.query({
        key: fileId,
      });

      // Upload to S3
      const response = await fetch(fileUploadRecordBefore?.upload_url, {
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
      const fileUploadRecordAfter = await trpcClient.artifact.get.query({
        key: fileId,
      });

      setUploadProgress(100);

      if (!fileUploadRecordAfter) {
        throw new Error('Failed to fetch file after upload');
      }

      // Convert tRPC result to IArtifact (dates are serialized as strings)
      const artifactRecord: IArtifact = {
        ...fileUploadRecordAfter,
        created_at: fileUploadRecordAfter.created_at
          ? new Date(fileUploadRecordAfter.created_at)
          : null,
        updated_at: fileUploadRecordAfter.updated_at
          ? new Date(fileUploadRecordAfter.updated_at)
          : null,
        download_url_expires_at: fileUploadRecordAfter.download_url_expires_at
          ? new Date(fileUploadRecordAfter.download_url_expires_at)
          : null,
        upload_url_expires_at: fileUploadRecordAfter.upload_url_expires_at
          ? new Date(fileUploadRecordAfter.upload_url_expires_at)
          : null,
      } as IArtifact;

      setUploadState(Success(artifactRecord));
      onUploadComplete?.(artifactRecord);
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
