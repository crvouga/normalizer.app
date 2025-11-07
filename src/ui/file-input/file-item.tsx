import * as React from 'react';
import { FilePreview } from '../file-preview/file-preview';
import { FileIcon, ImageIcon, IconX } from '../icons';
import { formatFileSize } from './file-utils';

export interface FileItemHeaderProps {
  file: File;
  index: number;
  showPreview?: boolean;
  isPreviewVisible: boolean;
  onTogglePreview: (index: number) => void;
  onRemove: (index: number) => void;
}

export const FileItemHeader: React.FC<FileItemHeaderProps> = ({
  file,
  index,
  showPreview = true,
  isPreviewVisible,
  onTogglePreview,
  onRemove,
}) => {
  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0">
          {file.type.startsWith('image/') ? (
            <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <ImageIcon />
            </div>
          ) : (
            <div className="bg-muted-foreground/10 flex h-10 w-10 items-center justify-center rounded-lg">
              <FileIcon />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-medium">{file.name}</p>
          <p className="text-muted-foreground text-xs">{formatFileSize(file.size)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showPreview && (
          <button
            type="button"
            onClick={() => onTogglePreview(index)}
            className="text-muted-foreground hover:text-foreground rounded px-2 py-1 text-xs transition-colors"
          >
            {isPreviewVisible ? 'Hide' : 'Preview'}
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="text-muted-foreground hover:text-destructive shrink-0 rounded p-1 transition-colors"
        >
          <IconX />
        </button>
      </div>
    </div>
  );
};

export interface FileItemProps {
  file: File;
  index: number;
  showPreview?: boolean;
  isPreviewVisible: boolean;
  onTogglePreview: (index: number) => void;
  onRemove: (index: number) => void;
}

export const FileItem: React.FC<FileItemProps> = ({
  file,
  index,
  showPreview = true,
  isPreviewVisible,
  onTogglePreview,
  onRemove,
}) => {
  return (
    <div className="bg-muted/50 overflow-hidden rounded-lg border">
      <FileItemHeader
        file={file}
        index={index}
        showPreview={showPreview}
        isPreviewVisible={isPreviewVisible}
        onTogglePreview={onTogglePreview}
        onRemove={onRemove}
      />

      {isPreviewVisible && showPreview && (
        <FilePreview file={file} maxRows={3} maxColumns={Infinity} className="text-sm" />
      )}
    </div>
  );
};
