import * as React from "react";
import { cn } from "~/src/lib/utils";
import { UploadIcon } from "../icon";

export interface DropZoneProps {
  className?: string;
  placeholder?: string;
  accept?: string;
  isDragOver: boolean;
  hasError: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}

export const DropZone = React.forwardRef<HTMLInputElement, DropZoneProps>(
  (
    {
      className,
      placeholder = "Click to upload or drag and drop",
      accept,
      isDragOver,
      hasError,
      onDragOver,
      onDragLeave,
      onDrop,
      onClick,
    },
    ref
  ) => {
    return (
      <div
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
          "hover:border-primary/50 hover:bg-accent/50",
          isDragOver && "border-primary bg-primary/5",
          hasError && "border-destructive",
          className
        )}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onClick}
      >
        <input ref={ref} type="file" accept={accept} className="hidden" />

        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <UploadIcon />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{placeholder}</p>
            {accept && (
              <p className="text-xs text-muted-foreground">
                Accepted formats: {accept}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }
);

DropZone.displayName = "DropZone";
