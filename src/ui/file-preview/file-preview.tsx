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
      <div className="rounded-lg bg-gray-100 p-6 text-center text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-400">
        Loading {fileType} file...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-100 p-6 text-center text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <FilePreviewTable data={data} className={className} maxRows={maxRows} maxColumns={maxColumns} />
  );
};
