import * as React from 'react';
import { cn } from '~/src/lib/utils';
import { UploadIcon } from '../icons';
import { Typography } from '../typography';

export interface DropZoneProps {
  className?: string;
  placeholder?: string;
  accept?: string;
  isDragOver: boolean;
  hasError: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}

export const DropZone = React.forwardRef<HTMLInputElement, DropZoneProps>(
  (
    {
      className,
      placeholder = 'Click to upload or drag and drop',
      accept,
      isDragOver,
      hasError,
      onDragOver,
      onDragLeave,
      onDrop,
      onClick,
    },
    ref,
  ) => {
    return (
      <div
        className={cn(
          'relative cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center transition-colors dark:border-gray-600',
          'hover:border-blue-500 hover:bg-blue-50 dark:hover:border-blue-400 dark:hover:bg-blue-950',
          isDragOver && 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950',
          hasError && 'border-destructive',
          className,
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onClick}
      >
        <input ref={ref} type="file" accept={accept} className="hidden" />

        <div className="flex flex-col items-center gap-4">
          <UploadIcon className="size-8" />

          <div className="space-y-1">
            <Typography variant="sm" weight="medium" color="primary">
              {placeholder}
            </Typography>
            {accept && (
              <Typography variant="xs" color="muted">
                Accepted formats: {accept}
              </Typography>
            )}
          </div>
        </div>
      </div>
    );
  },
);

DropZone.displayName = 'DropZone';
