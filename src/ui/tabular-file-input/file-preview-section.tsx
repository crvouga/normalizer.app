import * as React from 'react';
import { TabularFilePreview } from '../tabular-file-preview/tabular-file-preview';
import { formatFileSize } from './file-utils';
import { Typography } from '../typography';

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
    <div className="bg-white p-2 dark:bg-gray-800">
      <div className="mb-2 flex items-center gap-2">
        <Typography as="h6" variant="sm" weight="medium" color="primary">
          {file.name}
        </Typography>
        <Typography variant="xs" color="muted">
          {formatFileSize(file.size)}
        </Typography>
      </div>
      <TabularFilePreview file={file} maxRows={5} maxColumns={8} className="text-sm" />
    </div>
  );
};
