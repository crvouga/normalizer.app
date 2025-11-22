/**
 * Schema definition for a column in tabular data
 */
export interface ColumnSchema {
  name: string;
  type: 'text' | 'integer' | 'numeric' | 'boolean' | 'date' | 'timestamp';
  nullable?: boolean;
}

/**
 * Result of parsing CSV content
 */
export interface ParsedCsv {
  schema: ColumnSchema[];
  dataRows: string[][];
  headers: string[];
}

/**
 * Parse CSV content into schema and data rows
 * @param csvContent - The CSV content as a string
 * @param sanitizeIdentifier - Optional function to sanitize column names (e.g., for SQL identifiers)
 * @returns Parsed CSV with schema, data rows, and headers
 */
export function parseCsv(
  csvContent: string,
  sanitizeIdentifier?: (identifier: string) => string,
): ParsedCsv {
  const lines = csvContent.split('\n').filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return { schema: [], dataRows: [], headers: [] };
  }

  // Parse header row
  const headerLine = lines[0]!;
  const headers = parseCsvLine(headerLine);
  const sanitizedHeaders = sanitizeIdentifier
    ? headers.map((h) => sanitizeIdentifier(h.trim()))
    : headers.map((h) => h.trim());

  // Infer column types from first data rows
  const sampleRows: string[][] = [];
  const maxSampleSize = Math.min(1000, lines.length - 1); // Sample up to 1000 rows
  for (let i = 1; i <= maxSampleSize && i < lines.length; i++) {
    const row = parseCsvLine(lines[i]!);
    // Pad row to match header length
    while (row.length < sanitizedHeaders.length) {
      row.push('');
    }
    sampleRows.push(row.slice(0, sanitizedHeaders.length));
  }

  // Infer schema from sample data
  const schema: ColumnSchema[] = sanitizedHeaders.map((name, index) => {
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
    const row = parseCsvLine(lines[i]!);
    // Pad or truncate row to match header length
    while (row.length < sanitizedHeaders.length) {
      row.push('');
    }
    dataRows.push(row.slice(0, sanitizedHeaders.length));
  }

  return { schema, dataRows, headers: sanitizedHeaders };
}

/**
 * Parse a CSV line, handling quoted values
 * Simple implementation - handles basic quoted CSV
 * @param line - A single line of CSV content
 * @returns Array of field values
 */
export function parseCsvLine(line: string): string[] {
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
 * @param values - Array of string values from a column
 * @returns Inferred column type
 */
export function inferColumnType(values: string[]): ColumnSchema['type'] {
  if (values.length === 0) {
    return 'text'; // Default to text if no data
  }

  // Check for boolean
  const booleanValues = new Set(['true', 'false', 'yes', 'no', '1', '0', 'y', 'n']);
  if (values.every((v) => booleanValues.has(v.toLowerCase()))) {
    return 'boolean';
  }

  // Check for integer
  if (values.every((v) => /^-?\d+$/.test(v))) {
    return 'integer';
  }

  // Check for numeric (decimal)
  if (values.every((v) => /^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(v))) {
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
