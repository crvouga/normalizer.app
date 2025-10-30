import * as React from 'react';
import { DropZone } from './drop-zone';
import { FileList } from './file-list';
import { validateFiles, createFileListFromFiles } from './file-utils';

export interface FileInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  onFilesChange?: (files: FileList | null) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  className?: string;
  placeholder?: string;
  showPreview?: boolean;
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  (
    {
      className,
      onFilesChange,
      accept,
      multiple = false,
      maxFiles = 10,
      maxSize = 10 * 1024 * 1024, // 10MB default
      placeholder = 'Click to upload or drag and drop',
      showPreview = true,
      ...props
    },
    ref,
  ) => {
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const [showPreviews, setShowPreviews] = React.useState<Record<number, boolean>>({});
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => fileInputRef.current!);

    const handleFiles = (files: FileList | null) => {
      if (!files) return;

      const validationError = validateFiles(files, maxFiles, maxSize);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      const fileArray = Array.from(files);
      setSelectedFiles((prev) => (multiple ? [...prev, ...fileArray] : fileArray));
      // Initialize previews as open for new files
      const newPreviews = fileArray.reduce(
        (acc, _, index) => {
          acc[selectedFiles.length + index] = true;
          return acc;
        },
        {} as Record<number, boolean>,
      );
      setShowPreviews((prev) => ({ ...prev, ...newPreviews }));
      onFilesChange?.(files);
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      handleFiles(files);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
    };

    const handleClick = () => {
      fileInputRef.current?.click();
    };

    const removeFile = (index: number) => {
      const newFiles = selectedFiles.filter((_, i) => i !== index);
      setSelectedFiles(newFiles);

      // Create a new FileList-like object for the callback
      const newFileList = createFileListFromFiles(newFiles);
      onFilesChange?.(newFileList);
    };

    const togglePreview = (index: number) => {
      setShowPreviews((prev) => ({
        ...prev,
        [index]: !prev[index],
      }));
    };

    const clearAllFiles = () => {
      setSelectedFiles([]);
      setError(null);
      setShowPreviews({});
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onFilesChange?.(null);
    };

    return (
      <div className="w-full">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleInputChange}
          className="hidden"
          {...props}
        />

        {/* Drop Zone - Only show when no files selected */}
        {selectedFiles.length === 0 && (
          <DropZone
            className={className}
            placeholder={placeholder}
            accept={accept}
            isDragOver={isDragOver}
            hasError={!!error}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
          />
        )}

        {/* Error Message */}
        {error && <p className="text-destructive mt-2 text-sm">{error}</p>}

        {/* Selected Files */}
        <FileList
          files={selectedFiles}
          showPreview={showPreview}
          showPreviews={showPreviews}
          onTogglePreview={togglePreview}
          onRemoveFile={removeFile}
          onAddMore={handleClick}
          onClearAll={clearAllFiles}
        />
      </div>
    );
  },
);

FileInput.displayName = 'FileInput';

export { FileInput };
