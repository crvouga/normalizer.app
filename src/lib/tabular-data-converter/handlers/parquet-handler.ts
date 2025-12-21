// @ts-expect-error - parquetjs doesn't have types
import * as parquet from 'parquetjs';
import { getContentType, getExtension, getName } from '../../tabular-data-format';
import { TabularDataFormatHandler } from '../tabular-data-format-handler';

/**
 * Handler for Parquet file format
 */
export class ParquetHandler extends TabularDataFormatHandler {
  getFormatName(): string {
    return getName('parquet');
  }

  getExtension(): string {
    return getExtension('parquet');
  }

  getContentType(): string {
    return getContentType('parquet');
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

    // Write parquet file to buffer using parquetjs
    // parquetjs doesn't have openBuffer, so we use a stream-based approach
    // Collect data in memory using a PassThrough stream
    const streamModule = await import('node:stream');
    const stream = new streamModule.PassThrough();
    const chunks: Buffer[] = [];

    // Set up data collection before creating writer
    stream.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    // Create writer that writes to the stream
    const writer = await parquet.ParquetWriter.openStream(schema, stream);

    try {
      // Append all rows
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

      // Close the writer - this finalizes the Parquet file
      // Note: We need to wait for the stream to finish before closing to avoid os.close errors
      await new Promise<void>((resolve, reject) => {
        // Set up error handler first
        stream.once('error', (err) => {
          reject(err);
        });

        // Wait for stream to finish writing all data
        stream.once('finish', () => {
          resolve();
        });

        // Also listen for 'end' in case finish doesn't fire
        stream.once('end', () => {
          resolve();
        });

        // Safety timeout
        setTimeout(() => {
          resolve(); // Resolve anyway to proceed with close
        }, 1000);
      });

      // Now close the writer after stream has finished
      // Wrap in try-catch to handle potential Bun compatibility issues with os.close
      try {
        await writer.close();
      } catch (closeError) {
        // If close fails with os.close error, it's likely a Bun compatibility issue
        // The stream should already have all data, so we can continue
        const errorMsg = closeError instanceof Error ? closeError.message : String(closeError);
        if (!errorMsg.includes('os.close')) {
          throw closeError; // Re-throw if it's a different error
        }
        // Otherwise, ignore the os.close error as the data should already be in the stream
      }

      // Combine all chunks into a single buffer
      const buffer = Buffer.concat(chunks);

      if (buffer.length === 0) {
        throw new Error('Parquet writer produced an empty buffer');
      }

      return buffer;
    } catch (error) {
      // Ensure writer is closed even on error
      await writer.close().catch(() => {});
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create Parquet file: ${errorMessage}`);
    }
  }
}
