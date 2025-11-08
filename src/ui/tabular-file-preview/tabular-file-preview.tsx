import * as React from 'react';
import { useTabularFilePreview } from './use-tabular-file-preview';
import { TabularFilePreviewTable } from './tabular-file-preview-table';
import { Typography } from '../typography';

interface TabularFilePreviewProps {
  file: File;
  className?: string;
  maxRows?: number;
  maxColumns?: number;
}

export const TabularFilePreview: React.FC<TabularFilePreviewProps> = ({
  file,
  className,
  maxRows = 10,
  maxColumns = 10,
}) => {
  const { data, error, isLoading, fileType } = useTabularFilePreview(file);

  if (isLoading) {
    return (
      <div className="rounded-lg bg-gray-100 p-6 text-center dark:bg-gray-800">
        <Typography variant="sm" color="muted">
          Loading {fileType} file...
        </Typography>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-100 p-6 text-center dark:bg-red-900/20">
        <Typography variant="sm" color="error">
          {error}
        </Typography>
      </div>
    );
  }

  return (
    <TabularFilePreviewTable
      data={data}
      className={className}
      maxRows={maxRows}
      maxColumns={maxColumns}
    />
  );
};
