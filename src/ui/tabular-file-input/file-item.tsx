import * as React from 'react';
import { TabularFilePreview } from '../tabular-file-preview/tabular-file-preview';
import { FileIcon, ImageIcon, IconX, IconPencil } from '../icons';
import { formatFileSize } from './file-utils';
import { Typography } from '../typography';
import { cn } from '~/src/lib/utils';

export interface FileItemHeaderProps {
  file: File;
  index: number;
  showPreview?: boolean;
  isPreviewVisible: boolean;
  onTogglePreview: (index: number) => void;
  onRemove: (index: number) => void;
  onRename: (index: number, newName: string) => void;
}

export const FileItemHeader: React.FC<FileItemHeaderProps> = ({
  file,
  index,
  showPreview = true,
  isPreviewVisible,
  onTogglePreview,
  onRemove,
  onRename,
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(file.name);
  const [isHovering, setIsHovering] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset edit value when file name changes
  React.useEffect(() => {
    setEditValue(file.name);
  }, [file.name]);

  // Focus input when entering edit mode
  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditValue(file.name);
  };

  const handleSaveEdit = () => {
    const trimmedValue = editValue.trim();
    if (trimmedValue && trimmedValue !== file.name) {
      onRename(index, trimmedValue);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(file.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleBlur = () => {
    handleSaveEdit();
  };

  return (
    <div
      className="flex items-center justify-between p-3"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0">
          {file.type.startsWith('image/') ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg">
              <ImageIcon />
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-lg">
              <FileIcon />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              className={cn(
                'w-full rounded border border-blue-500 bg-white px-2 py-1 text-sm font-medium',
                'text-gray-900 ring-2 ring-blue-500/20 outline-none',
                'dark:border-blue-400 dark:bg-gray-800 dark:text-white dark:ring-blue-400/20',
              )}
            />
          ) : (
            <div className="group flex items-center gap-1">
              <Typography variant="sm" weight="medium" color="primary" className="truncate">
                {file.name}
              </Typography>
              {(isHovering || isEditing) && (
                <button
                  type="button"
                  onClick={handleStartEdit}
                  className="shrink-0 rounded p-0.5 text-gray-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                  aria-label="Rename file"
                >
                  <IconPencil className="size-3.5" />
                </button>
              )}
            </div>
          )}
          <Typography variant="xs" color="muted">
            {formatFileSize(file.size)}
          </Typography>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showPreview && (
          <button
            type="button"
            onClick={() => onTogglePreview(index)}
            className="rounded px-2 py-1 transition-colors"
          >
            <Typography
              variant="xs"
              color="muted"
              className="hover:text-gray-900 dark:hover:text-gray-100"
            >
              {isPreviewVisible ? 'Hide' : 'Preview'}
            </Typography>
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
  onRename: (index: number, newName: string) => void;
}

export const FileItem: React.FC<FileItemProps> = ({
  file,
  index,
  showPreview = true,
  isPreviewVisible,
  onTogglePreview,
  onRemove,
  onRename,
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
        onRename={onRename}
      />

      {isPreviewVisible && showPreview && (
        <TabularFilePreview file={file} maxRows={3} maxColumns={Infinity} className="text-sm" />
      )}
    </div>
  );
};
