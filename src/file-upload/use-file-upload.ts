import { useState } from 'react';

import type { FileMetadata } from './file-upload-orpc-server';
import { orpcClient } from '../orpc-client';

interface UseFileUploadOptions {
  onUploadComplete?: (file: FileMetadata) => void;
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
      const result = await orpcClient.fileUpload.getUploadUrl({
        filename: file.name,
        contentType: file.type,
      });

      if (result[0]) {
        throw new Error(result[0].message || 'Failed to get upload URL');
      }

      const { uploadUrl, fileId } = result[1]!;

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
      const markResult = await orpcClient.fileUpload.markUploaded({
        key: fileId,
        size: file.size,
      });

      if (markResult[0]) {
        throw new Error(markResult[0].message || 'Failed to mark file as uploaded');
      }

      // Invalidate and refetch file data
      const fileResult = await orpcClient.fileUpload.getFile({
        key: fileId,
      });

      if (fileResult[0]) {
        throw new Error(fileResult[0].message || 'Failed to fetch file data');
      }

      const fileData = fileResult[1];

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
