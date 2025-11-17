// @ts-expect-error - parquetjs doesn't have types
import * as parquet from 'parquetjs';
import { FileFormatHandler } from '../file-format-handler';

/**
 * Handler for Parquet file format
 */
export class ParquetHandler extends FileFormatHandler {
  getFormatName(): string {
    return 'parquet';
  }

  getExtension(): string {
    return 'parquet';
  }

  getContentType(): string {
    return 'application/octet-stream';
  }

  detect(buffer: Buffer, filename: string): boolean {
    // Check magic bytes first (Parquet files start with PAR1)
    const magicBytes = buffer.subarray(0, Math.min(4, buffer.length));
    if (
      magicBytes[0] === 0x50 &&
      magicBytes[1] === 0x41 &&
      magicBytes[2] === 0x52 &&
      magicBytes[3] === 0x31
    ) {
      return true;
    }

    // Fallback to extension-based detection
    const ext = filename.toLowerCase().split('.').pop();
    return ext === 'parquet';
  }

  async toCsv(buffer: Buffer): Promise<string> {
    // Create a reader from buffer
    const reader = await parquet.ParquetReader.openBuffer(buffer);
    const cursor = reader.getCursor();
    const rows: string[][] = [];
    let headers: string[] | undefined;

    // Read all rows
    let row;
    while ((row = await cursor.next())) {
      if (!headers) {
        headers = Object.keys(row);
      }
      rows.push(Object.values(row) as string[]);
    }

    await reader.close();

    // Convert to CSV
    if (!headers || rows.length === 0) {
      return '';
    }

    const csvRows = [headers.join(',')];

    // Add data rows
    for (const row of rows) {
      csvRows.push(row.map((cell) => String(cell ?? '')).join(','));
    }

    return csvRows.join('\n');
  }

  async fromCsv(csvData: string): Promise<Buffer> {
    const lines = csvData.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      throw new Error('CSV data is empty');
    }

    // Parse CSV (simple implementation - assumes no quoted commas)
    const rows = lines.map((line) => line.split(',').map((cell) => cell.trim()));

    if (rows.length === 0) {
      throw new Error('No data rows found');
    }

    const headers = rows[0];
    if (!headers || headers.length === 0) {
      throw new Error('No headers found in CSV');
    }

    const dataRows = rows.slice(1);

    // Create schema from headers (all fields as strings for simplicity)
    const schema = new parquet.ParquetSchema(
      Object.fromEntries(headers.map((header) => [header, { type: 'UTF8' }])),
    );

    // Write parquet file to buffer
    const writer = await parquet.ParquetWriter.openBuffer(schema);

    for (const row of dataRows) {
      const record: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (header) {
          record[header] = row[i] || '';
        }
      }
      await writer.appendRow(record);
    }

    await writer.close();
    return writer.getBuffer();
  }
}
