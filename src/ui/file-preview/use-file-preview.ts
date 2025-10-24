import { useMemo } from "react";
import { getFileType, parseCSV, parseExcel, parseJSON } from "./parsers";
import type { FilePreviewResult } from "./types";
import { useFilePreviewBase } from "./use-file-preview-base";

export const useFilePreview = (file: File): FilePreviewResult => {
  const fileType = getFileType(file);

  const parser = useMemo(() => {
    switch (fileType) {
      case "csv":
        return parseCSV;
      case "json":
        return parseJSON;
      case "excel":
        return parseExcel;
      default:
        return null;
    }
  }, [fileType]);

  if (!parser) {
    return {
      data: null,
      error: "Unsupported file type",
      isLoading: false,
      fileType,
    };
  }

  return useFilePreviewBase({ file, parser, fileType });
};
