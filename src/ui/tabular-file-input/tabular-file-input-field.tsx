import * as React from 'react';
import { TabularFileInput } from './tabular-file-input';

interface TabularFileInputFieldProps {
  id: string;
  label: string;
  maxFiles?: number;
  maxSize?: number;
  onFilesChange?: (files: FileList | null) => void;
  placeholder?: string;
  accept?: string;
  multiple?: boolean;
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
}) => {
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
