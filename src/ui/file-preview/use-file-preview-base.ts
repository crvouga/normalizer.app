import * as React from 'react';
import type { FilePreviewResult, FileType } from './types';

interface UseFilePreviewBaseParams {
  file: File;
  parser: (file: File) => Promise<any[]>;
  fileType: FileType;
}

export const useFilePreviewBase = ({
  file,
  parser,
  fileType,
}: UseFilePreviewBaseParams): FilePreviewResult => {
  const [data, setData] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const parseFile = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const parsedData = await parser(file);
        setData(parsedData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse file');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    parseFile();
  }, [file, parser]);

  return { data, error, isLoading, fileType };
};
