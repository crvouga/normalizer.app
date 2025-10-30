import * as React from 'react';
import { useFilePreview } from './use-file-preview';
import { FilePreviewTable } from './file-preview-table';

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
      <div className="text-muted-foreground bg-muted/20 rounded-lg p-6 text-center text-sm">
        Loading {fileType} file...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive bg-destructive/10 rounded-lg p-6 text-center text-sm">
        {error}
      </div>
    );
  }

  return (
    <FilePreviewTable data={data} className={className} maxRows={maxRows} maxColumns={maxColumns} />
  );
};
