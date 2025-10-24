import * as React from "react";
import { cn } from "~/src/lib/utils";
import { UploadIcon, ImageIcon, FileIcon, XIcon } from "./icon";

export interface FileInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "onChange"
  > {
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
      placeholder = "Click to upload or drag and drop",
      showPreview = true,
      ...props
    },
    ref
  ) => {
    const [isDragOver, setIsDragOver] = React.useState(false);
    const [selectedFiles, setSelectedFiles] = React.useState<File[]>([]);
    const [error, setError] = React.useState<string | null>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => fileInputRef.current!);

    const validateFiles = (files: FileList): string | null => {
      if (files.length > maxFiles) {
        return `Maximum ${maxFiles} files allowed`;
      }

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > maxSize) {
          return `File "${
            file.name
          }" is too large. Maximum size is ${formatFileSize(maxSize)}`;
        }
      }

      return null;
    };

    const formatFileSize = (bytes: number): string => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const handleFiles = (files: FileList | null) => {
      if (!files) return;

      const validationError = validateFiles(files);
      if (validationError) {
        setError(validationError);
        return;
      }

      setError(null);
      const fileArray = Array.from(files);
      setSelectedFiles((prev) =>
        multiple ? [...prev, ...fileArray] : fileArray
      );
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
      const dataTransfer = new DataTransfer();
      newFiles.forEach((file) => dataTransfer.items.add(file));
      onFilesChange?.(dataTransfer.files);
    };

    const clearAllFiles = () => {
      setSelectedFiles([]);
      setError(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      onFilesChange?.(null);
    };

    return (
      <div className="w-full">
        {/* Drop Zone */}
        <div
          className={cn(
            "relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
            "hover:border-primary/50 hover:bg-accent/50",
            isDragOver && "border-primary bg-primary/5",
            error && "border-destructive",
            className
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple={multiple}
            onChange={handleInputChange}
            className="hidden"
            {...props}
          />

          <div className="flex flex-col items-center gap-2">
            <UploadIcon />
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{placeholder}</span>
              {accept && (
                <p className="text-xs mt-1">Accepted formats: {accept}</p>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}

        {/* File Preview */}
        {showPreview && selectedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                Selected Files ({selectedFiles.length})
              </h4>
              <button
                type="button"
                onClick={clearAllFiles}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between p-3 bg-muted rounded-md"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="shrink-0">
                      {file.type.startsWith("image/") ? (
                        <div className="w-8 h-8 bg-primary/10 rounded flex items-center justify-center">
                          <ImageIcon />
                        </div>
                      ) : (
                        <div className="w-8 h-8 bg-muted-foreground/10 rounded flex items-center justify-center">
                          <FileIcon />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <XIcon />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

FileInput.displayName = "FileInput";

export { FileInput };
