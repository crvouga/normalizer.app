export const NormalizationProgressMessages = {
  starting: 'Starting normalization...',
  readingFiles: 'Reading your files...',
  loadedFile: (name: string, count: number) => `Loaded ${name} (${count} rows)`,
  analyzing: 'Analyzing how to transform your data...',
  applying: 'Applying changes...',
  generatingOutput: 'Generating your normalized file...',
  complete: 'Done! Your file is ready.',
  failed: 'Something went wrong while normalizing your file. Please try again.',
} as const;
