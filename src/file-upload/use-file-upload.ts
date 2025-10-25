import { useState } from "react";
import { trpcReactClient, trpcClient } from "../trpc-client";
import type { FileMetadata } from "./file-upload-router";

interface UseFileUploadOptions {
  onUploadComplete?: (file: FileMetadata) => void;
  onUploadError?: (error: Error) => void;
}

export const useFileUpload = ({
  onUploadComplete,
  onUploadError,
}: UseFileUploadOptions) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const utils = trpcReactClient.useUtils();
  const getUploadUrl = trpcReactClient.fileUpload.getUploadUrl.useMutation();
  const markUploaded = trpcReactClient.fileUpload.markUploaded.useMutation();

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Get presigned URL
      const { uploadUrl, fileId } = await getUploadUrl.mutateAsync({
        filename: file.name,
        contentType: file.type,
      });

      // Upload to S3
      const response = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      // Mark as uploaded in database
      await markUploaded.mutateAsync({
        key: fileId,
        size: file.size,
      });

      // Invalidate and refetch file data
      await utils.fileUpload.getFile.invalidate({ key: fileId });
      const fileData = await utils.fileUpload.getFile.fetch({
        key: fileId,
      });

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
