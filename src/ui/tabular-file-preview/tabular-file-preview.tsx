import * as React from 'react';
import { useTabularFilePreview } from './use-tabular-file-preview';
import { TabularFilePreviewTable } from './tabular-file-preview-table';
import { Typography } from '../typography';
import { toI18nText } from '../../i18n/types';

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
  const { data, error, isLoading } = useTabularFilePreview(file);

  if (error) {
    return (
      <div className="rounded-lg bg-red-100 p-6 text-center dark:bg-red-900/20">
        <Typography variant="sm" color="error" text={toI18nText(error)} />
      </div>
    );
  }

  return (
    <TabularFilePreviewTable
      data={data}
      {...(className !== undefined ? { className } : {})}
      maxRows={maxRows}
      maxColumns={maxColumns}
      isLoading={isLoading}
    />
  );
};
