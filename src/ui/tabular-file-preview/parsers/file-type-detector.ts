import type { FileType } from '../types';

/**
 * Detects file type from MIME type (content type) with optional filename fallback.
 * Prioritizes MIME type over file extension for more reliable detection.
 */
export const getFileTypeFromMimeType = (
  mimeType: string | undefined,
  filename?: string,
): FileType => {
  // Normalize MIME type to lowercase for comparison
  const normalizedMimeType = mimeType?.toLowerCase();

  // Primary detection: Use MIME type
  if (normalizedMimeType) {
    // CSV files
    if (normalizedMimeType === 'text/csv' || normalizedMimeType === 'application/csv') {
      return 'csv';
    }

    // JSON files
    if (normalizedMimeType === 'application/json' || normalizedMimeType === 'text/json') {
      return 'json';
    }

    // Excel files (both old and new formats)
    if (
      normalizedMimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || // .xlsx
      normalizedMimeType === 'application/vnd.ms-excel' // .xls
    ) {
      return 'excel';
    }
  }

  // Fallback detection: Use file extension if MIME type is missing or generic
  if (filename && (!normalizedMimeType || normalizedMimeType === 'application/octet-stream')) {
    const lowerFilename = filename.toLowerCase();
    if (lowerFilename.endsWith('.csv')) return 'csv';
    if (lowerFilename.endsWith('.json')) return 'json';
    if (lowerFilename.endsWith('.xlsx') || lowerFilename.endsWith('.xls')) return 'excel';
  }

  return 'unsupported';
};

/**
 * Detects file type from a File object.
 * Uses the File's MIME type and filename.
 */
export const getFileType = (file: File): FileType => {
  return getFileTypeFromMimeType(file.type, file.name);
};
