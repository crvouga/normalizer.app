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
    if (file && file.size > maxSize) {
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

/**
 * Creates a new File object with a different name while preserving content and type.
 * Since File objects are immutable, this creates a new instance.
 */
export const renameFile = (file: File, newName: string): File => {
  return new File([file], newName, { type: file.type, lastModified: file.lastModified });
};
