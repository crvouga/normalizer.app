import * as React from 'react';
import { useFileLoader } from '../../shared/use-file-loader';
import type { I18nText } from '../../i18n/types';
import { toI18nText } from '../../i18n/types';
import { ButtonBase } from '../button-base';
import { File, Eye, EyeOff, Trash2, Image } from 'lucide-react';
import { type Icon } from '../icons';
import { TabularFilePreview } from '../tabular-file-preview/tabular-file-preview';
import { TabularFilePreviewTable } from '../tabular-file-preview/tabular-file-preview-table';
import { Typography } from '../typography';
import { useI18n } from '../../i18n/use-i18n';
import type { TabularFile } from './tabular-file';
import { formatFileSize } from './tabular-file-utils';

export interface TabularFileAction {
  label: I18nText;
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

/**
 * Shared container wrapper for TabularFileItem and TabularFileItemSkeleton.
 * Ensures consistent styling between the two components.
 */
const TabularFileItemContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800">
      {children}
    </div>
  );
};

/**
 * Shared header structure for TabularFileItem and TabularFileItemSkeleton.
 * Ensures consistent layout between the two components.
 */
const TabularFileItemHeaderStructure: React.FC<{
  icon: React.ReactNode;
  content: React.ReactNode;
  actions: React.ReactNode;
}> = ({ icon, content, actions }) => {
  return (
    <div className="flex items-center justify-between p-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="shrink-0">
          <div className="flex size-10 items-center justify-center rounded-lg">{icon}</div>
        </div>
        <div className="min-w-0 flex-1">{content}</div>
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
  );
};

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
  const { t } = useI18n();
  const isImage = tabularFile.contentType?.startsWith('image/');
  const actions: TabularFileAction[] = [];

  if (showPreview) {
    actions.push({
      label: t('tabularFileInput.preview'),
      icon: isPreviewVisible ? EyeOff : Eye,
      onClick: () => onTogglePreview(index),
    });
  }

  if (customActions.length > 0) actions.push(...customActions);

  if (!readOnly) {
    actions.push({
      label: t('tabularFileInput.remove'),
      icon: Trash2,
      onClick: () => onRemove(index),
    });
  }

  const icon = isImage ? <Image className="size-6" /> : <File className="size-6" />;

  const content = (
    <>
      <Typography
        variant="sm"
        weight="medium"
        color="primary"
        className="truncate"
        text={toI18nText(tabularFile.name)}
      />
      {tabularFile.size !== undefined && (
        <Typography
          variant="xs"
          color="muted"
          text={toI18nText(formatFileSize(tabularFile.size))}
        />
      )}
    </>
  );

  const actionsContent = actions.map((action, actionIndex) => {
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
          text={action.label}
        />
      </ButtonBase>
    );
  });

  return <TabularFileItemHeaderStructure icon={icon} content={content} actions={actionsContent} />;
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
    <TabularFileItemContainer>
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
          <div className="w-full">
            {error ? (
              <div className="rounded-lg bg-red-100 p-6 text-center dark:bg-red-900/20">
                <Typography variant="sm" color="error" text={toI18nText(error)} />
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
        </div>
      )}
    </TabularFileItemContainer>
  );
};

/**
 * Skeleton placeholder for a TabularFileItem that hasn't loaded yet.
 * Matches the height and structure of TabularFileItem to prevent layout shift.
 * Colocated with TabularFileItem to ensure they stay in sync.
 */
export const TabularFileItemSkeleton: React.FC = () => {
  return (
    <TabularFileItemContainer>
      <TabularFileItemHeaderStructure
        icon={<File className="size-6 text-slate-300 dark:text-slate-600" />}
        content={
          <div className="space-y-1">
            <div className="h-4 w-32 animate-pulse rounded bg-slate-300 dark:bg-slate-600" />
            <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
          </div>
        }
        actions={<div className="h-6 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />}
      />
    </TabularFileItemContainer>
  );
};
