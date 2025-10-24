import * as React from "react";
import { FilePreview } from "../file-preview/file-preview";
import { formatFileSize } from "./file-utils";

export interface FilePreviewSectionProps {
  file: File;
  isVisible: boolean;
  className?: string;
}

export const FilePreviewSection: React.FC<FilePreviewSectionProps> = ({
  file,
  isVisible,
  className,
}) => {
  if (!isVisible) return null;

  return (
    <div className="bg-card p-2">
      <div className="flex items-center gap-2 mb-2">
        <h6 className="text-sm font-medium text-foreground">{file.name}</h6>
        <span className="text-xs text-muted-foreground">
          {formatFileSize(file.size)}
        </span>
      </div>
      <FilePreview file={file} maxRows={5} maxColumns={8} className="text-sm" />
    </div>
  );
};
