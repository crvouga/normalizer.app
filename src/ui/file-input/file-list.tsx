import * as React from 'react';
import { FileItem } from './file-item';

export interface FileListProps {
  files: File[];
  showPreview?: boolean;
  showPreviews: Record<number, boolean>;
  onTogglePreview: (index: number) => void;
  onRemoveFile: (index: number) => void;
  onAddMore: () => void;
  onClearAll: () => void;
}

export const FileList: React.FC<FileListProps> = ({
  files,
  showPreview = true,
  showPreviews,
  onTogglePreview,
  onRemoveFile,
  onAddMore,
  onClearAll,
}) => {
  if (files.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-foreground text-sm font-medium">Selected Files ({files.length})</h4>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddMore}
            className="text-primary hover:text-primary/80 text-xs transition-colors"
          >
            Add more
          </button>
          <button
            type="button"
            onClick={onClearAll}
            className="text-muted-foreground hover:text-destructive text-xs transition-colors"
          >
            Clear all
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
          />
        ))}
      </div>
    </div>
  );
};
