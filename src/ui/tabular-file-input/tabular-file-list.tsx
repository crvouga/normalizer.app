import * as React from 'react';
import { TabularFileItem, type TabularFileAction } from './tabular-file-item';
import { Typography } from '../typography';
import type { TabularFile } from './tabular-file';

export interface FileListProps {
  files: TabularFile[];
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
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          {onAddMore && (
            <button type="button" onClick={onAddMore} className="transition-colors">
              <Typography variant="xs" color="info" className="hover:opacity-80">
                Add more
              </Typography>
            </button>
          )}
          <button type="button" onClick={onClearAll} className="transition-colors">
            <Typography variant="xs" color="muted">
              Clear all
            </Typography>
          </button>
        </div>
      </div>
    </div>
  );
};
