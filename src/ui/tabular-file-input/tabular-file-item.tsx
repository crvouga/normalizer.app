import * as React from 'react';
import { useFileLoader } from '../../lib/use-file-loader';
import { ButtonBase } from '../button-base';
import { FileIcon, IconEye, IconEyeSlash, IconTrash, ImageIcon, type Icon } from '../icons';
import { TabularFilePreview } from '../tabular-file-preview/tabular-file-preview';
import { TabularFilePreviewTable } from '../tabular-file-preview/tabular-file-preview-table';
import { Typography } from '../typography';
import type { TabularFile } from './tabular-file';
import { formatFileSize } from './tabular-file-utils';

export interface TabularFileAction {
  label: string;
  icon: Icon;
  onClick: (file: TabularFile, index: number) => void;
}

export interface TabularFileItemHeaderProps {
  tabularFile: TabularFile;
  index: number;
  showPreview?: boolean;
  isPreviewVisible: boolean;
  onTogglePreview: (index: number) => void;
  onRemove: (index: number) => void;
  customActions?: TabularFileAction[];
  readOnly?: boolean;
}

export const TabularFileItemHeader: React.FC<TabularFileItemHeaderProps> = ({
  tabularFile,
  index,
  showPreview = true,
  isPreviewVisible,
  onTogglePreview,
  onRemove,
  customActions = [],
  readOnly = false,
}) => {
  const isImage = tabularFile.contentType?.startsWith('image/');
  const actions: TabularFileAction[] = [];

  if (showPreview) {
    actions.push({
      label: 'Preview',
      icon: isPreviewVisible ? IconEyeSlash : IconEye,
      onClick: () => onTogglePreview(index),
    });
  }

  if (customActions.length > 0) actions.push(...customActions);

  if (!readOnly) {
    actions.push({
      label: 'Remove',
      icon: IconTrash,
      onClick: () => onRemove(index),
    });
  }

  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0">
          <div className="flex size-10 items-center justify-center rounded-lg">
            {isImage ? <ImageIcon className="size-6" /> : <FileIcon className="size-6" />}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <Typography variant="sm" weight="medium" color="primary" className="truncate">
            {tabularFile.name}
          </Typography>
          {tabularFile.size !== undefined && (
            <Typography variant="xs" color="muted">
              {formatFileSize(tabularFile.size)}
            </Typography>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {actions.map((action, actionIndex) => {
          const IconComponent = action.icon;
          return (
            <ButtonBase
              key={`${action.label}-${actionIndex}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                action.onClick(tabularFile, index);
              }}
              className="flex items-center gap-1 rounded px-2 py-1 transition-colors"
            >
              <IconComponent className="size-3.5 shrink-0" />
              <Typography
                variant="xs"
                color="muted"
                className="hover:text-slate-900 dark:hover:text-slate-100"
              >
                {action.label}
              </Typography>
            </ButtonBase>
          );
        })}
      </div>
    </div>
  );
};

export interface TabularFileItemProps {
  tabularFile: TabularFile;
  index: number;
  showPreview?: boolean;
  isPreviewVisible: boolean;
  onTogglePreview: (index: number) => void;
  onRemove: (index: number) => void;
  customActions?: TabularFileAction[];
  readOnly?: boolean;
}

/**
 * Component for displaying a single file with optional preview.
 * Lazy-loads the actual File object when preview is requested.
 */
export const TabularFileItem: React.FC<TabularFileItemProps> = ({
  tabularFile,
  index,
  showPreview = true,
  isPreviewVisible,
  onTogglePreview,
  onRemove,
  customActions,
  readOnly = false,
}) => {
  const { loadedFile, isLoading, error } = useFileLoader({
    downloadUrl: tabularFile.downloadUrl,
    fileName: tabularFile.name,
    ...(tabularFile.contentType && { contentType: tabularFile.contentType }),
    enabled: isPreviewVisible,
  });

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800">
      <TabularFileItemHeader
        tabularFile={tabularFile}
        index={index}
        showPreview={showPreview}
        isPreviewVisible={isPreviewVisible}
        onTogglePreview={onTogglePreview}
        onRemove={onRemove}
        readOnly={readOnly}
        {...(customActions !== undefined ? { customActions } : {})}
      />

      {isPreviewVisible && showPreview && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          {error ? (
            <div className="rounded-lg bg-red-100 p-6 text-center dark:bg-red-900/20">
              <Typography variant="sm" color="error">
                {error}
              </Typography>
            </div>
          ) : isLoading || !loadedFile ? (
            <TabularFilePreviewTable
              data={null}
              maxRows={3}
              maxColumns={Infinity}
              className="text-sm"
              isLoading={true}
            />
          ) : (
            <TabularFilePreview
              file={loadedFile}
              maxRows={3}
              maxColumns={Infinity}
              className="text-sm"
            />
          )}
        </div>
      )}
    </div>
  );
};
