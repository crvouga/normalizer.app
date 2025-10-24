import * as React from "react";
import { useFilePreview } from "./use-file-preview";
import { FilePreviewTable } from "./file-preview-table";

interface FilePreviewProps {
  file: File;
  className?: string;
  maxRows?: number;
  maxColumns?: number;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  className,
  maxRows = 10,
  maxColumns = 10,
}) => {
  const { data, error, isLoading, fileType } = useFilePreview(file);

  if (isLoading) {
    return (
      <div className="text-sm text-muted-foreground p-6 text-center border rounded-lg bg-muted/20">
        Loading {fileType} file...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive p-6 text-center border rounded-lg bg-destructive/10 border-destructive/20">
        {error}
      </div>
    );
  }

  return (
    <FilePreviewTable
      data={data}
      className={className}
      maxRows={maxRows}
      maxColumns={maxColumns}
    />
  );
};
