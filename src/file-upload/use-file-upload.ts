import { useState } from "react";
import { trpc } from "../trpc-client";
import type { FileMetadata } from "./file-upload-router";

interface UseFileUploadOptions {
  userId?: string;
  onUploadComplete?: (file: FileMetadata) => void;
  onUploadError?: (error: Error) => void;
}

export const useFileUpload = ({
  userId,
  onUploadComplete,
  onUploadError,
}: UseFileUploadOptions) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const utils = trpc.useUtils();
  const getUploadUrl = trpc.fileUpload.getUploadUrl.useMutation();
  const markUploaded = trpc.fileUpload.markUploaded.useMutation();

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Get presigned URL
      const result = await getUploadUrl.mutateAsync({
        filename: file.name,
        contentType: file.type,
      });
      const { uploadUrl, fileKey } = result as {
        uploadUrl: string;
        fileKey: string;
      };

      // Upload to S3
      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to upload file");
      }

      // Mark as uploaded in database
      await markUploaded.mutateAsync({
        key: fileKey,
        size: file.size,
      });

      // Invalidate and refetch file data
      await utils.fileUpload.getFile.invalidate({ key: fileKey });
      const fileData = await utils.fileUpload.getFile.fetch({ key: fileKey });

      // Invalidate files cache
      await utils.fileUpload.listFiles.invalidate();

      setUploadProgress(100);
      onUploadComplete?.(fileData);
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
