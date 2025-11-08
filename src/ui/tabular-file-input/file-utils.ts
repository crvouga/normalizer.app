/**
 * Utility functions for file handling and validation
 */

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const validateFiles = (
  files: FileList,
  maxFiles: number,
  maxSize: number,
): string | null => {
  if (files.length > maxFiles) {
    return `Maximum ${maxFiles} files allowed`;
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > maxSize) {
      return `File "${file.name}" is too large. Maximum size is ${formatFileSize(maxSize)}`;
    }
  }

  return null;
};

export const createFileListFromFiles = (files: File[]): FileList => {
  const dataTransfer = new DataTransfer();
  files.forEach((file) => dataTransfer.items.add(file));
  return dataTransfer.files;
};
