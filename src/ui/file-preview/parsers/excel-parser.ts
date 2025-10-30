import * as XLSX from 'xlsx';
import type { FileType } from '../types';

export const parseExcel = async (file: File): Promise<Record<string, unknown>[]> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Get the first worksheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('No worksheets found in Excel file');
    }

    const worksheet = workbook.Sheets[firstSheetName];

    // Convert worksheet to JSON array
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Use first row as headers
      defval: '', // Default value for empty cells
    });

    if (jsonData.length === 0) {
      return [];
    }

    // First row contains headers
    const headers = jsonData[0] as string[];
    if (!headers || headers.length === 0) {
      throw new Error('No headers found in Excel file');
    }

    // Convert remaining rows to objects
    const rows = jsonData.slice(1) as unknown[][];

    return rows.map((row) => {
      const obj: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || '';
      });
      return obj;
    });
  } catch (error) {
    throw new Error(
      `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
};

export const getExcelFileType = (): FileType => 'excel';
