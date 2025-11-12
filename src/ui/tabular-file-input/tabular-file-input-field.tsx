import * as React from 'react';
import { TabularFileInput } from './tabular-file-input';
import { TabularFileList } from './tabular-file-list';
import type { TabularFile } from './tabular-file';

interface TabularFileInputFieldProps {
  id: string;
  label: string;
  maxFiles?: number;
  maxSize?: number;
  onFilesChange?: (files: FileList | null) => void;
  placeholder?: string;
  accept?: string;
  multiple?: boolean;
  readOnly?: boolean;
  files?: TabularFile[];
}

export const TabularFileInputField: React.FC<TabularFileInputFieldProps> = ({
  id,
  label,
  maxFiles,
  maxSize,
  onFilesChange,
  placeholder,
  accept,
  multiple,
  readOnly = false,
  files = [],
}) => {
  const [showPreviews, setShowPreviews] = React.useState<Record<number, boolean>>({
    0: true,
  });

  if (readOnly) {
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        {files.length > 0 && (
          <div className="[&_.flex.items-center.justify-end]:hidden [&_button:has(svg)]:hidden">
            <TabularFileList
              files={files}
              showPreview={true}
              showPreviews={showPreviews}
              onTogglePreview={(index) => {
                setShowPreviews((prev) => ({
                  ...prev,
                  [index]: !prev[index],
                }));
              }}
              onRemoveFile={() => {}}
              onClearAll={() => {}}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      <TabularFileInput
        id={id}
        {...(multiple !== undefined ? { multiple } : {})}
        {...(maxFiles !== undefined ? { maxFiles } : {})}
        {...(maxSize !== undefined ? { maxSize } : {})}
        {...(onFilesChange !== undefined ? { onFilesChange } : {})}
        {...(placeholder !== undefined ? { placeholder } : {})}
        {...(accept !== undefined ? { accept } : {})}
        showPreview
      />
    </div>
  );
};
