import * as React from 'react';
import { TabularFilePreview } from '../tabular-file-preview/tabular-file-preview';
import { formatFileSize } from './tabular-file-utils';
import { Typography } from '../typography';
import { toI18nText } from '../../i18n/types';

export interface FilePreviewSectionProps {
  file: File;
  isVisible: boolean;
  className?: string;
}

export const FilePreviewSection: React.FC<FilePreviewSectionProps> = ({ file, isVisible }) => {
  if (!isVisible) return null;

  return (
    <div className="bg-white p-2 dark:bg-slate-800">
      <div className="mb-2 flex items-center gap-2">
        <Typography
          as="h6"
          variant="sm"
          weight="medium"
          color="primary"
          text={toI18nText(file.name)}
        />
        <Typography variant="xs" color="muted" text={toI18nText(formatFileSize(file.size))} />
      </div>
      <TabularFilePreview file={file} maxRows={5} maxColumns={8} className="text-sm" />
    </div>
  );
};
