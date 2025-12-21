import * as XLSX from 'xlsx';
import { getContentType } from '../../tabular-data-format';
import { TabularDataFormatHandler } from '../tabular-data-format-handler';

/**
 * Handler for Excel file formats (.xlsx, .xls, .xlsm)
 */
export class ExcelHandler extends TabularDataFormatHandler {
  getFormatName(): string {
    return 'excel';
  }

  getExtension(): string {
    return 'xlsx';
  }

  getContentType(): string {
    return getContentType('excel');
  }

  detect(buffer: Buffer, filename: string): boolean {
    // Check magic bytes first
    const magicBytes = buffer.subarray(0, Math.min(8, buffer.length));

    // Excel .xlsx files start with PK (ZIP signature)
    if (magicBytes[0] === 0x50 && magicBytes[1] === 0x4b) {
      // Could be xlsx or other zip-based formats, check extension
      const ext = filename.toLowerCase().split('.').pop();
      if (ext === 'xlsx' || ext === 'xlsm') {
        return true;
      }
    }

    // Excel .xls files (OLE2 format)
    if (
      magicBytes[0] === 0xd0 &&
      magicBytes[1] === 0xcf &&
      magicBytes[2] === 0x11 &&
      magicBytes[3] === 0xe0
    ) {
      return true;
    }

    // Fallback to extension-based detection
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'xlsx' || ext === 'xls' || ext === 'xlsm';
  }

  async toCsv(buffer: Buffer): Promise<string> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    // Use the first sheet
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('Excel file has no sheets');
    }
    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
      throw new Error(`Sheet "${firstSheetName}" not found in workbook`);
    }
    return XLSX.utils.sheet_to_csv(worksheet);
  }

  async fromCsv(csvData: string): Promise<Buffer> {
    const worksheet = XLSX.utils.aoa_to_sheet(
      csvData.split('\n').map((row) => {
        // Parse CSV row (simple comma split, doesn't handle quoted values perfectly)
        return row.split(',').map((cell) => cell.trim());
      }),
    );
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
  }
}
