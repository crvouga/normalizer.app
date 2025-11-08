import { useMemo } from 'react';
import { getFileType, parseCSV, parseExcel, parseJSON } from './parsers';
import type { TabularFilePreviewResult } from './types';
import { useTabularFilePreviewBase } from './use-tabular-file-preview-base';

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
