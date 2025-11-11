import * as React from 'react';
import { TabularFilePreview } from '../tabular-file-preview/tabular-file-preview';
import { FileIcon, ImageIcon, IconX } from '../icons';
import { formatFileSize } from './tabular-file-utils';
import { Typography } from '../typography';
import type { TabularFile } from './tabular-file';
import { ButtonBase } from '../button-base';

export interface TabularFileAction {
  label: string;
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
}

export const TabularFileItemHeader: React.FC<TabularFileItemHeaderProps> = ({
  tabularFile,
  index,
  showPreview = true,
  isPreviewVisible,
  onTogglePreview,
  onRemove,
  customActions = [],
}) => {
  const isImage = tabularFile.contentType?.startsWith('image/');

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
        {showPreview && (
          <ButtonBase
            type="button"
            onClick={() => onTogglePreview(index)}
            className="rounded px-2 py-1 transition-colors"
          >
            <Typography
              variant="xs"
              color="muted"
              className="hover:text-slate-900 dark:hover:text-slate-100"
            >
              {isPreviewVisible ? 'Hide' : 'Preview'}
            </Typography>
          </ButtonBase>
        )}
        {customActions.map((action, actionIndex) => (
          <ButtonBase
            key={`${action.label}-${actionIndex}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              action.onClick(tabularFile, index);
            }}
            className="rounded px-2 py-1 transition-colors"
          >
            <Typography
              variant="xs"
              color="muted"
              className="hover:text-slate-900 dark:hover:text-slate-100"
            >
              {action.label}
            </Typography>
          </ButtonBase>
        ))}
        <ButtonBase
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="shrink-0 rounded p-1 text-slate-600 transition-colors dark:text-slate-400"
        >
          <IconX />
        </ButtonBase>
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
}) => {
  const [loadedFile, setLoadedFile] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Lazy load the file when preview is visible
  React.useEffect(() => {
    if (!isPreviewVisible || loadedFile) {
      return;
    }

    const loadFile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Ensure the protocol matches the current app to avoid mixed content errors
        let downloadUrl = tabularFile.downloadUrl;
        if (
          typeof window !== 'undefined' &&
          downloadUrl.startsWith('http') &&
          window.location.protocol &&
          !downloadUrl.startsWith(window.location.protocol)
        ) {
          // Replace protocol with the current protocol (http: or https:)
          downloadUrl = downloadUrl.replace(/^https?:/, window.location.protocol);
        }
        const response = await fetch(downloadUrl);
        if (!response.ok) {
          throw new Error(`Failed to download file: ${response.statusText}`);
        }

        const blob = await response.blob();
        const file = new File([blob], tabularFile.name, {
          type: tabularFile.contentType || 'application/octet-stream',
        });

        setLoadedFile(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load file');
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [isPreviewVisible, tabularFile, loadedFile]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
      <TabularFileItemHeader
        tabularFile={tabularFile}
        index={index}
        showPreview={showPreview}
        isPreviewVisible={isPreviewVisible}
        onTogglePreview={onTogglePreview}
        onRemove={onRemove}
        customActions={customActions}
      />

      {isPreviewVisible && showPreview && (
        <div className="border-t border-slate-200 dark:border-slate-700">
          {isLoading && (
            <div className="p-6 text-center">
              <Typography variant="sm" color="muted">
                Loading file...
              </Typography>
            </div>
          )}
          {error && (
            <div className="rounded-lg bg-red-100 p-6 text-center dark:bg-red-900/20">
              <Typography variant="sm" color="error">
                {error}
              </Typography>
            </div>
          )}
          {loadedFile && !isLoading && !error && (
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
