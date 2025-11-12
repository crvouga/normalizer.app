import { useMemo } from 'react';
import { getFileType, getFileTypeFromMimeType, parseCSV, parseExcel, parseJSON } from './parsers';
import type { TabularFilePreviewResult } from './types';
import { useTabularFilePreviewBase } from './use-tabular-file-preview-base';

/**
 * Hook for previewing tabular files using File object.
 * Automatically detects file type from MIME type and filename.
 */
export const useTabularFilePreview = (file: File): TabularFilePreviewResult => {
  const fileType = getFileType(file);

  const parser = useMemo(() => {
    switch (fileType) {
      case 'csv':
        return parseCSV;
      case 'json':
        return parseJSON;
      case 'excel':
        return parseExcel;
      default:
        return null;
    }
  }, [fileType]);

  if (!parser) {
    return {
      data: null,
      error: 'Unsupported file type',
      isLoading: false,
      fileType,
    };
  }

  return useTabularFilePreviewBase({ file, parser, fileType });
};

/**
 * Hook for previewing tabular files when you have MIME type and filename separately.
 * Useful for remote files (Artifacts) where content type is stored separately.
 * Detects file type primarily from MIME type, with filename as fallback.
 */
export const useTabularFilePreviewWithMimeType = (
  file: File,
  mimeType: string | undefined,
  filename?: string,
): TabularFilePreviewResult => {
  const fileType = getFileTypeFromMimeType(mimeType, filename);

  const parser = useMemo(() => {
    switch (fileType) {
      case 'csv':
        return parseCSV;
      case 'json':
        return parseJSON;
      case 'excel':
        return parseExcel;
      default:
        return null;
    }
  }, [fileType]);

  if (!parser) {
    return {
      data: null,
      error: 'Unsupported file type',
      isLoading: false,
      fileType,
    };
  }

  return useTabularFilePreviewBase({ file, parser, fileType });
};
