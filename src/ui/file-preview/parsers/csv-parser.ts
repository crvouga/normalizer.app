import type { FileType } from '../types';

export const parseCSV = async (file: File): Promise<Record<string, unknown>[]> => {
  const text = await file.text();
  const rows = text.split('\n').filter((row) => row.trim() !== '');

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].split(',').map((h) => h.trim());

  return rows.slice(1).map((row) => {
    const values = row.split(',');
    return headers.reduce(
      (obj, header, index) => {
        obj[header] = values[index]?.trim() || '';
        return obj;
      },
      {} as Record<string, unknown>,
    );
  });
};

export const getCSVFileType = (): FileType => 'csv';
