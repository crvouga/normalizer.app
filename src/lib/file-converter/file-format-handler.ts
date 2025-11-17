/**
 * Abstract interface for file format handlers
 * Each handler knows how to detect, convert to/from CSV, and provide format metadata
 */
export abstract class FileFormatHandler {
  /**
   * Detect if the given buffer matches this file format
   * @param buffer File buffer to check
   * @param filename Original filename (for extension-based detection)
   * @returns true if buffer matches this format
   */
  abstract detect(buffer: Buffer, filename: string): boolean;

  /**
   * Get the format identifier (e.g., 'excel', 'csv', 'parquet')
   */
  abstract getFormatName(): string;

  /**
   * Get the file extension for this format (without dot)
   */
  abstract getExtension(): string;

  /**
   * Get the MIME content type for this format
   */
  abstract getContentType(): string;

  /**
   * Convert this format to CSV (intermediate format)
   * @param buffer Buffer containing file in this format
   * @returns CSV string
   */
  abstract toCsv(buffer: Buffer): Promise<string>;

  /**
   * Convert CSV to this format
   * @param csvData CSV string data
   * @returns Buffer containing file in this format
   */
  abstract fromCsv(csvData: string): Promise<Buffer>;
}
