import { useMemo, useState } from 'react';

import { trpcClient } from '../trpc-client';
import type { IFileUploadRecord } from './file-record';
import type { RemoteResult } from '../lib/result';
import { NotAsked, Loading, Success, Failure } from '../lib/result';

interface UseFileUploadOptions {
  onUploadComplete?: (file: IFileUploadRecord) => void;
  onUploadError?: (error: Error) => void;
}

export const useFileUpload = ({ onUploadComplete, onUploadError }: UseFileUploadOptions) => {
  // Use RemoteResult for the main upload state
  const [uploadState, setUploadState] = useState<RemoteResult<IFileUploadRecord, Error>>(NotAsked);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File) => {
    setUploadState(Loading);
    setUploadProgress(0);
    try {
      // Get presigned URL
      const { fileId } = await trpcClient.fileUpload.start.mutate({
        filename: file.name,
        contentType: file.type,
      });

      const fileUploadRecordBefore = await trpcClient.fileUpload.get.query({
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
      await trpcClient.fileUpload.finish.mutate({
        key: fileId,
        size: file.size,
      });

      // Invalidate and refetch file data
      const fileUploadRecordAfter = await trpcClient.fileUpload.get.query({
        key: fileId,
      });

      setUploadProgress(100);

      if (fileUploadRecordAfter) {
        setUploadState(Success(fileUploadRecordAfter));
        onUploadComplete?.(fileUploadRecordAfter);
      } else {
        throw new Error('Failed to fetch file after upload');
      }
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
