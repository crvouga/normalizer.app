import { useState } from "react";
import { trpc, trpcClient } from "../trpc-client";
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

  const utils = trpc.useUtils();
  const getUploadUrl = trpc.fileUpload.getUploadUrl.useMutation();
  const markUploaded = trpc.fileUpload.markUploaded.useMutation();

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadProgress(0);

      // Get presigned URL
      const got = await trpcClient.fileUpload.getUploadUrl.mutate({
        filename: file.name,
        contentType: file.type,
      });

      // Upload to S3
      const response = await fetch(got.uploadUrl, {
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
        key: got.fileId,
        size: file.size,
      });

      // Invalidate and refetch file data
      await utils.fileUpload.getFile.invalidate({ key: got.fileId });
      const fileData = await utils.fileUpload.getFile.fetch({
        key: got.fileId,
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
