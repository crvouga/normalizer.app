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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
              <ImageIcon />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700">
              <FileIcon />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
            {file.name}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">{formatFileSize(file.size)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showPreview && (
          <button
            type="button"
            onClick={() => onTogglePreview(index)}
            className="rounded px-2 py-1 text-xs text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
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
          className="shrink-0 rounded p-1 text-gray-600 transition-colors hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
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
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
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
