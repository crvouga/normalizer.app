import * as React from 'react';
import { cn } from '~/src/lib/cn';
import type { I18nText } from '../../i18n/types';
import { UploadIcon } from '../icons';
import { Typography } from '../typography';
import { useI18n } from '../../i18n/use-i18n';

export interface DropZoneProps {
  className?: string;
  placeholder?: I18nText;
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
      placeholder,
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
    const { t } = useI18n();
    const defaultPlaceholder = placeholder ?? t('tabularFileInput.uploadPlaceholder');

    return (
      <div
        className={cn(
          'relative cursor-pointer rounded-lg border-2 border-dashed border-slate-300 p-8 text-center transition-colors dark:border-slate-600',
          'hover:border-fuchsia-500 hover:bg-fuchsia-50 dark:hover:border-fuchsia-400 dark:hover:bg-fuchsia-950',
          isDragOver &&
            'border-fuchsia-500 bg-fuchsia-50 dark:border-fuchsia-400 dark:bg-fuchsia-950',
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
            <Typography variant="sm" weight="medium" color="primary" text={defaultPlaceholder} />
            {accept && (
              <Typography
                variant="xs"
                color="muted"
                text={t('tabularFileInput.acceptedFormats', { formats: accept })}
              />
            )}
          </div>
        </div>
      </div>
    );
  },
);

DropZone.displayName = 'DropZone';
