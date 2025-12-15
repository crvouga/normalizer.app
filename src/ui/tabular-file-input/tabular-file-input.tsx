import * as React from 'react';
import type { I18nText } from '../../i18n/types';
import { DropZone } from './drop-zone';
import { TabularFileList } from './tabular-file-list';
import { validateFiles, createFileListFromFiles } from './tabular-file-utils';
import { Typography } from '../typography';
import { useI18n } from '../../i18n/use-i18n';
import type { TabularFile } from './tabular-file';

export interface TabularFileInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'placeholder'
> {
  onFilesChange?: (files: FileList | null) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  className?: string;
  placeholder?: I18nText;
  showPreview?: boolean;
}

/**
 * Converts a local File to a TabularFile with a blob URL
 */
function fileToTabularFile(file: File): TabularFile {
  return {
    name: file.name,
    downloadUrl: URL.createObjectURL(file),
    size: file.size,
    contentType: file.type,
  };
}

const TabularFileInput = React.forwardRef<HTMLInputElement, TabularFileInputProps>(
  (
    {
      className,
      onFilesChange,
      accept,
      multiple = false,
      maxFiles = 10,
      maxSize = 10 * 1024 * 1024, // 10MB default
      placeholder,
      showPreview = true,
      ...props
    },
    ref,
  ) => {
    const { t } = useI18n();
    const defaultPlaceholder = placeholder ?? t('tabularFileInput.uploadPlaceholder');
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
    const [tabularFiles, setTabularFiles] = React.useState<TabularFile[]>([]);
    const [error, setError] = React.useState<I18nText | null>(null);
    const [showPreviews, setShowPreviews] = React.useState<Record<number, boolean>>({});
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => fileInputRef.current!);

    // Clean up blob URLs on unmount
    React.useEffect(() => {
      return () => {
        tabularFiles.forEach((file) => {
          if (file.downloadUrl.startsWith('blob:')) {
            URL.revokeObjectURL(file.downloadUrl);
          }
        });
      };
    }, [tabularFiles]);

    const handleFiles = (files: FileList | null) => {
      if (!files) return;

      const validationError = validateFiles(files, maxFiles, maxSize, t);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      const fileArray = Array.from(files);
      const newSelectedFiles = multiple ? [...selectedFiles, ...fileArray] : fileArray;
      const newTabularFiles = newSelectedFiles.map(fileToTabularFile);

      setSelectedFiles(newSelectedFiles);
      setTabularFiles(newTabularFiles);

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
      // Revoke the blob URL for the removed file
      const removedFile = tabularFiles[index];
      if (removedFile?.downloadUrl.startsWith('blob:')) {
        URL.revokeObjectURL(removedFile.downloadUrl);
      }

      const newFiles = selectedFiles.filter((_, i) => i !== index);
      const newTabularFiles = tabularFiles.filter((_, i) => i !== index);

      setSelectedFiles(newFiles);
      setTabularFiles(newTabularFiles);

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
      // Revoke all blob URLs
      tabularFiles.forEach((file) => {
        if (file.downloadUrl.startsWith('blob:')) {
          URL.revokeObjectURL(file.downloadUrl);
        }
      });

      setSelectedFiles([]);
      setTabularFiles([]);
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
            {...(className !== undefined ? { className } : {})}
            placeholder={defaultPlaceholder}
            {...(accept !== undefined ? { accept } : {})}
            isDragOver={isDragOver}
            hasError={!!error}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
          />
        )}

        {/* Error Message */}
        {error && <Typography variant="sm" color="error" className="mt-2" text={error} />}

        {/* Selected Files */}
        <TabularFileList
          files={tabularFiles}
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

TabularFileInput.displayName = 'TabularFileInput';

export { TabularFileInput };
