import * as React from 'react';
import { TabularFileItem, type TabularFileAction } from './tabular-file-item';
import { Typography } from '../typography';
import type { TabularFile } from './tabular-file';

export interface FileListProps {
  files: TabularFile[];
  title?: string;
  showPreview?: boolean;
  showPreviews: Record<number, boolean>;
  onTogglePreview: (index: number) => void;
  onRemoveFile: (index: number) => void;
  onAddMore?: () => void;
  onClearAll: () => void;
  customActions?: TabularFileAction[];
}

/**
 * Component for displaying a list of tabular files with optional previews.
 * Works with both local files (via blob URLs) and remote files (via download URLs).
 */
export const TabularFileList: React.FC<FileListProps> = ({
  files,
  title = 'Selected Files',
  showPreview = true,
  showPreviews,
  onTogglePreview,
  onRemoveFile,
  onAddMore,
  onClearAll,
  customActions,
}) => {
  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Typography as="h4" variant="sm" weight="medium" color="primary">
          {title} ({files.length})
        </Typography>
        <div className="flex items-center gap-2">
          {onAddMore && (
            <button type="button" onClick={onAddMore} className="transition-colors">
              <Typography variant="xs" color="info" className="hover:opacity-80">
                Add more
              </Typography>
            </button>
          )}
          <button type="button" onClick={onClearAll} className="transition-colors">
            <Typography
              variant="xs"
              color="muted"
              className="hover:text-red-600 dark:hover:text-red-400"
            >
              Clear all
            </Typography>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {files.map((file, index) => (
          <TabularFileItem
            key={file.id || `${file.name}-${index}`}
            tabularFile={file}
            index={index}
            showPreview={showPreview}
            isPreviewVisible={showPreviews[index] || false}
            onTogglePreview={onTogglePreview}
            onRemove={onRemoveFile}
            customActions={customActions}
          />
        ))}
      </div>
    </div>
  );
};
