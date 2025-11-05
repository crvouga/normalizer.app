import { useState } from 'react';

import { trpcClient } from '../trpc-client';
import type { IFileUploadRecord } from './file-upload-record';

interface UseFileUploadOptions {
  onUploadComplete?: (file: IFileUploadRecord) => void;
  onUploadError?: (error: Error) => void;
}

export const useFileUpload = ({ onUploadComplete, onUploadError }: UseFileUploadOptions) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Get presigned URL
      const { uploadUrl, fileId } = await trpcClient.fileUpload.getUploadUrl.mutate({
        filename: file.name,
        contentType: file.type,
      });

      // Upload to S3
      const response = await fetch(uploadUrl, {
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
      await trpcClient.fileUpload.markUploaded.mutate({
        key: fileId,
        size: file.size,
      });

      // Invalidate and refetch file data
      const fileData = await trpcClient.fileUpload.getFile.query({
        key: fileId,
      });

      // Invalidate files cache

      setUploadProgress(100);
      if (fileData) {
        onUploadComplete?.(fileData);
      }
    } catch (error) {
      onUploadError?.(error as Error);
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadFile,
    isUploading,
    uploadProgress,
  };
};
