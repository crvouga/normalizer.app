import { getContentType } from '../../tabular-data-format';
import { TabularDataFormatHandler } from '../tabular-data-format-handler';

/**
 * Handler for CSV file format
 */
export class CsvHandler extends TabularDataFormatHandler {
  getFormatName(): string {
    return 'csv';
  }

  getExtension(): string {
    return 'csv';
  }

  getContentType(): string {
    return getContentType('csv');
  }

  detect(buffer: Buffer, filename: string): boolean {
    // Check extension first
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'csv') {
      // Verify it looks like CSV by checking for comma, semicolon, or tab
      const text = buffer.toString('utf-8', 0, Math.min(1024, buffer.length));
      if (text.includes(',') || text.includes(';') || text.includes('\t')) {
        return true;
      }
    }
    return false;
  }

  async toCsv(buffer: Buffer): Promise<string> {
    // Already CSV, just return as string
    return buffer.toString('utf-8');
  }

  async fromCsv(csvData: string): Promise<Buffer> {
    // Already CSV, just convert to buffer
    return Buffer.from(csvData, 'utf-8');
  }
}
