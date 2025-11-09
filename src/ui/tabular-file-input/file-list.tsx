import * as React from 'react';
import { FileItem } from './file-item';
import { Typography } from '../typography';

export interface FileListProps {
  files: File[];
  showPreview?: boolean;
  showPreviews: Record<number, boolean>;
  onTogglePreview: (index: number) => void;
  onRemoveFile: (index: number) => void;
  onRenameFile: (index: number, newName: string) => void;
  onAddMore: () => void;
  onClearAll: () => void;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  showPreview = true,
  showPreviews,
  onTogglePreview,
  onRemoveFile,
  onRenameFile,
  onAddMore,
  onClearAll,
}) => {
  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Typography as="h4" variant="sm" weight="medium" color="primary">
          Selected Files ({files.length})
        </Typography>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onAddMore} className="transition-colors">
            <Typography variant="xs" color="info" className="hover:opacity-80">
              Add more
            </Typography>
          </button>
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
          <FileItem
            key={`${file.name}-${index}`}
            file={file}
            index={index}
            showPreview={showPreview}
            isPreviewVisible={showPreviews[index] || false}
            onTogglePreview={onTogglePreview}
            onRemove={onRemoveFile}
            onRename={onRenameFile}
          />
        ))}
      </div>
    </div>
  );
};
