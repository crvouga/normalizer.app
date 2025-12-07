/**
 * Schema definition for a column in tabular data
 */
export interface CsvColumnSchema {
  name: string;
  type: 'text' | 'integer' | 'numeric' | 'boolean' | 'date' | 'timestamp';
  nullable?: boolean;
}

/**
 * Result of parsing CSV content
 */
export interface ParsedCsv {
  schema: CsvColumnSchema[];
  dataRows: string[][];
  headers: string[];
}

/**
 * Parse CSV content into schema and data rows
 * @param csvContent - The CSV content as a string
 * @returns Parsed CSV with schema, data rows, and headers
 */
function parse(csvContent: string): ParsedCsv {
  const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { schema: [], dataRows: [], headers: [] };
  }

  // Parse header row
  const headerLine = lines[0]!;
  const headers = parseLine(headerLine);

  // Infer column types from first data rows
  const sampleRows: string[][] = [];
  const maxSampleSize = Math.min(1000, lines.length - 1); // Sample up to 1000 rows
  for (let i = 1; i <= maxSampleSize && i < lines.length; i++) {
    const row = parseLine(lines[i]!);
    // Pad row to match header length
    while (row.length < headers.length) {
      row.push('');
    }
    sampleRows.push(row.slice(0, headers.length));
  }

  // Infer schema from sample data
  const schema: CsvColumnSchema[] = headers.map((name, index) => {
    const columnValues = sampleRows.map((row) => row[index]?.trim() || '').filter((v) => v !== '');
    const inferredType = inferColumnType(columnValues);
    return {
      name,
      type: inferredType,
      nullable: true, // All columns are nullable by default
    };
  });

  // Parse all data rows
  const dataRows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i]!);
    // Pad or truncate row to match header length
    while (row.length < headers.length) {
      row.push('');
    }
    dataRows.push(row.slice(0, headers.length));
  }

  return { schema, dataRows, headers };
}

/**
 * Parse a CSV line, handling quoted values
 * Simple implementation - handles basic quoted CSV
 * @param line - A single line of CSV content
 * @returns Array of field values
 */
function parseLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  // Add last field
  result.push(current);

  return result;
}

/**
 * Infer PostgreSQL column type from sample values
 *
 * IMPORTANT: This function takes a conservative approach to type inference.
 * Since we only sample the first 1000 rows of a CSV file, we cannot be certain
 * that all rows will match the inferred type. To prevent import failures when
 * non-conforming values appear later in the file, we require a minimum sample
 * size before inferring strict numeric types.
 *
 * @param values - Array of string values from a column
 * @returns Inferred column type
 */
function inferColumnType(values: string[]): CsvColumnSchema['type'] {
  if (values.length === 0) {
    return 'text'; // Default to text if no data
  }

  // Minimum sample size for confident numeric type inference
  // If we have fewer samples, default to text to be safe
  const MIN_SAMPLE_SIZE_FOR_NUMERIC = Math.min(10, values.length);

  // Check for integer first (before boolean) to avoid false positives
  // If all values are numeric integers, prefer integer over boolean
  // This prevents columns with numeric values like "1", "2", "3" from being inferred as boolean
  // when the sample only contains "1"
  // CONSERVATIVE: Only infer integer if we have enough samples to be confident
  if (values.length >= MIN_SAMPLE_SIZE_FOR_NUMERIC && values.every((v) => /^-?\d+$/.test(v))) {
    return 'integer';
  }

  // Check for boolean (only explicit boolean strings, not numeric "1" and "0")
  // This ensures we only infer boolean for actual boolean representations
  const explicitBooleanValues = new Set(['true', 'false', 'yes', 'no', 'y', 'n']);
  if (values.every((v) => explicitBooleanValues.has(v.toLowerCase()))) {
    return 'boolean';
  }

  // Check for numeric (decimal)
  // CONSERVATIVE: Only infer numeric if we have enough samples to be confident
  if (
    values.length >= MIN_SAMPLE_SIZE_FOR_NUMERIC &&
    values.every((v) => /^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(v))
  ) {
    return 'numeric';
  }

  // Check for date/timestamp patterns
  const datePatterns = [
    /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, // YYYY-MM-DD HH:MM:SS
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO format
  ];
  if (values.every((v) => datePatterns.some((pattern) => pattern.test(v)))) {
    // Try to determine if it's date or timestamp
    if (values.some((v) => v.includes('T') || v.includes(' '))) {
      return 'timestamp';
    }

    return 'date';
  }

  // Default to text
  return 'text';
}

/**
 * CSV escape function: escape quotes and wrap with quotes if needed
 */
function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[,"\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Builder for creating CSV strings from arrays of objects
 */
class CsvBuilder<T extends Record<string, unknown>> {
  private headers: string[] | null = null;

  constructor(private readonly data: T[]) {}

  /**
   * Specify headers explicitly (useful when data array is empty)
   * @param headers - Array of header names
   * @returns The builder instance for method chaining
   */
  withHeader(headers: string[]): this {
    this.headers = headers;
    return this;
  }

  /**
   * Convert the builder to a CSV string
   * @returns The CSV string representation
   */
  toString(): string {
    if (this.data.length === 0) {
      return this.headers ? this.headers.join(',') : '';
    }

    const sourceKeys = Object.keys(this.data[0]!);
    const headers = this.headers || sourceKeys;

    // Build CSV rows
    const rows = [
      headers.join(','),
      ...this.data.map((row) =>
        headers
          .map((_, i) => {
            const key = sourceKeys[i];
            return escapeCsvValue(key ? row[key] : undefined);
          })
          .join(','),
      ),
    ];
    return rows.join('\n');
  }
}

/**
 * Converts an array of objects into a CSV builder.
 * @template T
 * @param {T[]} data - Array of objects to convert to CSV.
 * @returns {CsvBuilder<T>} A builder instance with methods to configure and generate CSV.
 */
function of<T extends Record<string, unknown>>(data: T[]): CsvBuilder<T> {
  return new CsvBuilder(data);
}

/**
 * Result of streaming CSV header parse
 */
export interface CsvStreamHeader {
  schema: CsvColumnSchema[];
  headers: string[];
}

/**
 * Parse just the header and schema from CSV content without loading all data.
 * This is memory-efficient for large files.
 * @param csvContent - The CSV content as a string
 * @returns Header information including schema
 */
function parseHeader(csvContent: string): CsvStreamHeader {
  const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { schema: [], headers: [] };
  }

  // Parse header row
  const headerLine = lines[0]!;
  const headers = parseLine(headerLine);

  // Infer column types from first data rows (up to 1000 or all available)
  const sampleRows: string[][] = [];
  const maxSampleSize = Math.min(1000, lines.length - 1);
  for (let i = 1; i <= maxSampleSize && i < lines.length; i++) {
    const row = parseLine(lines[i]!);
    // Pad row to match header length
    while (row.length < headers.length) {
      row.push('');
    }
    sampleRows.push(row.slice(0, headers.length));
  }

  // Infer schema from sample data
  const schema: CsvColumnSchema[] = headers.map((name, index) => {
    const columnValues = sampleRows.map((row) => row[index]?.trim() || '').filter((v) => v !== '');
    const inferredType = inferColumnType(columnValues);
    return {
      name,
      type: inferredType,
      nullable: true,
    };
  });

  return { schema, headers };
}

/**
 * Count the number of data rows in CSV content without parsing all data.
 * More efficient than loading and parsing the entire file.
 * @param csvContent - The CSV content as a string
 * @returns Number of data rows (excluding header)
 */
function countDataRows(csvContent: string): number {
  const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);
  return Math.max(0, lines.length - 1); // Subtract header
}

/**
 * Result of parsing CSV metadata for batch processing
 */
export interface ParsedCsvMetadata {
  schema: CsvColumnSchema[];
  headers: string[];
  lines: string[]; // Raw lines for batch processing (includes header at index 0)
  dataRowCount: number;
}

/**
 * Simplified result for batch processing without schema inference
 */
export interface ParsedCsvHeaders {
  headers: string[];
  lines: string[]; // Raw lines for batch processing (includes header at index 0)
  dataRowCount: number;
}

/**
 * Parse CSV headers and lines in a single pass without schema inference.
 * This is optimized for cases where all columns will be TEXT type.
 *
 * @param csvContent - The CSV content as a string
 * @returns Parsed CSV headers, lines array, and row count
 */
function parseHeaders(csvContent: string): ParsedCsvHeaders {
  // Split CSV only once - this is the expensive operation
  const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { headers: [], lines: [], dataRowCount: 0 };
  }

  // Parse header row only
  const headerLine = lines[0]!;
  const headers = parseLine(headerLine);

  const dataRowCount = Math.max(0, lines.length - 1); // Subtract header

  return {
    headers,
    lines, // Return all lines for batch processing
    dataRowCount,
  };
}

/**
 * Parse CSV metadata (header, schema, and lines) in a single pass.
 * This is optimized for batch processing where you want to process data
 * in chunks without loading all rows into memory at once.
 *
 * @param csvContent - The CSV content as a string
 * @returns Parsed CSV metadata with schema, headers, lines array, and row count
 */
function parseMetadata(csvContent: string): ParsedCsvMetadata {
  // Split CSV only once - this is the expensive operation
  const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { schema: [], headers: [], lines: [], dataRowCount: 0 };
  }

  // Parse header row
  const headerLine = lines[0]!;
  const headers = parseLine(headerLine);

  // Infer column types from first data rows (up to 1000 or all available)
  const sampleRows: string[][] = [];
  const maxSampleSize = Math.min(1000, lines.length - 1);
  for (let i = 1; i <= maxSampleSize && i < lines.length; i++) {
    const row = parseLine(lines[i]!);
    // Pad row to match header length
    while (row.length < headers.length) {
      row.push('');
    }
    sampleRows.push(row.slice(0, headers.length));
  }

  // Infer schema from sample data
  const schema: CsvColumnSchema[] = headers.map((name, index) => {
    const columnValues = sampleRows.map((row) => row[index]?.trim() || '').filter((v) => v !== '');
    const inferredType = inferColumnType(columnValues);
    return {
      name,
      type: inferredType,
      nullable: true,
    };
  });

  const dataRowCount = Math.max(0, lines.length - 1); // Subtract header

  return {
    schema,
    headers,
    lines, // Return all lines for batch processing
    dataRowCount,
  };
}

/**
 * CSV parsing utilities
 */
export const Csv = {
  of,
  parse,
  parseLine,
  inferColumnType,
  parseHeader,
  countDataRows,
  parseMetadata,
  parseHeaders,
};
