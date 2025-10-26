import * as React from "react";
import { FileInput } from "./file-input";

interface FileInputFieldProps {
  id: string;
  label: string;
  maxFiles?: number;
  maxSize?: number;
  onFilesChange?: (files: FileList | null) => void;
  placeholder?: string;
  accept?: string;
  multiple?: boolean;
}

export const FileInputField: React.FC<FileInputFieldProps> = ({
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
      <FileInput
        id={id}
        multiple={multiple}
        maxFiles={maxFiles}
        maxSize={maxSize}
        onFilesChange={onFilesChange}
        placeholder={placeholder}
        accept={accept}
        showPreview
      />
    </div>
  );
};
