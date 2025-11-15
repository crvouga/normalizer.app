import * as React from 'react';
import type { TabularFilePreviewResult, FileType } from './types';

interface UseTabularFilePreviewBaseParams {
  file: File;
  parser: (file: File) => Promise<any[]>;
  fileType: FileType;
}

export const useTabularFilePreviewBase = ({
  file,
  parser,
  fileType,
}: UseTabularFilePreviewBaseParams): TabularFilePreviewResult => {
  const [data, setData] = React.useState<any[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const parseFile = async () => {
      try {
        setIsLoading(true);
        setError(null);

        await new Promise((resolve) => setTimeout(resolve, 1500));

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
