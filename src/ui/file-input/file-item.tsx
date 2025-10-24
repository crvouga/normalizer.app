import * as React from "react";
import { ImageIcon, FileIcon, XIcon } from "../icon";
import { formatFileSize } from "./file-utils";
import { FilePreviewSection } from "./file-preview-section";

export interface FileItemProps {
  file: File;
  index: number;
  showPreview?: boolean;
  isPreviewVisible: boolean;
  onTogglePreview: (index: number) => void;
  onRemove: (index: number) => void;
}

export const FileItem: React.FC<FileItemProps> = ({
  file,
  index,
  showPreview = true,
  isPreviewVisible,
  onTogglePreview,
  onRemove,
}) => {
  return (
    <div className="space-y-2">
      {/* File Item */}
      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="shrink-0">
            {file.type.startsWith("image/") ? (
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <ImageIcon />
              </div>
            ) : (
              <div className="w-10 h-10 bg-muted-foreground/10 rounded-lg flex items-center justify-center">
                <FileIcon />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate text-foreground">
              {file.name}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {showPreview && (
            <button
              type="button"
              onClick={() => onTogglePreview(index)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded"
            >
              {isPreviewVisible ? "Hide" : "Preview"}
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(index);
            }}
            className="shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors rounded"
          >
            <XIcon />
          </button>
        </div>
      </div>

      {/* File Preview */}
      <FilePreviewSection
        file={file}
        isVisible={showPreview && isPreviewVisible}
      />
    </div>
  );
};
