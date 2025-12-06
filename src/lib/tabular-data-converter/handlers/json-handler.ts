import { TabularDataFormatHandler } from '../tabular-data-format-handler';

/**
 * Handler for JSON file format (array of objects)
 */
export class JsonHandler extends TabularDataFormatHandler {
  getFormatName(): string {
    return 'json';
  }

  getExtension(): string {
    return 'json';
  }

  getContentType(): string {
    return 'application/json';
  }

  detect(buffer: Buffer, filename: string): boolean {
    // Check extension first
    const ext = filename.toLowerCase().split('.').pop();
    if (ext !== 'json') {
      return false;
    }

    // Try to parse as JSON and verify it's an array of objects
    try {
      const text = buffer.toString('utf-8');
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        return false;
      }
      // Verify all elements are objects (and not null)
      return parsed.every(
        (item) => typeof item === 'object' && item !== null && !Array.isArray(item),
      );
    } catch {
      // Not valid JSON or not an array of objects
      return false;
    }
  }

  async toCsv(buffer: Buffer): Promise<string> {
    const text = buffer.toString('utf-8');
    const jsonData = JSON.parse(text);

    if (!Array.isArray(jsonData)) {
      throw new Error('JSON must be an array');
    }

    if (jsonData.length === 0) {
      return '';
    }

    // Verify all elements are objects
    const invalidItem = jsonData.find(
      (item) => typeof item !== 'object' || item === null || Array.isArray(item),
    );
    if (invalidItem !== undefined) {
      throw new Error('JSON array must contain only objects');
    }

    // Collect all unique keys from all objects
    const allKeys = new Set<string>();
    for (const obj of jsonData) {
      for (const key of Object.keys(obj)) {
        allKeys.add(key);
      }
    }

    // Convert to array and sort for consistent column order
    const headers = Array.from(allKeys).sort();

    if (headers.length === 0) {
      return '';
    }

    // Create CSV rows
    const csvRows: string[] = [headers.join(',')];

    // Add data rows
    for (const obj of jsonData) {
      const row = headers.map((header) => {
        const value = obj[header];
        if (value === null || value === undefined) {
          return '';
        }
        // Convert value to string and escape commas/quotes if needed
        const stringValue = String(value);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  async fromCsv(csvData: string): Promise<Buffer> {
    const lines = csvData.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      return Buffer.from('[]', 'utf-8');
    }

    // Parse CSV line, handling quoted values
    const parseLine = (line: string): string[] => {
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
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }

      // Add last field
      result.push(current.trim());
      return result;
    };

    const rows = lines.map(parseLine);

    if (rows.length === 0) {
      return Buffer.from('[]', 'utf-8');
    }

    const headers = rows[0];
    if (!headers || headers.length === 0) {
      throw new Error('No headers found in CSV');
    }

    const dataRows = rows.slice(1);

    // Convert rows to array of objects
    const jsonArray = dataRows.map((row) => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (header) {
          obj[header] = row[i] || '';
        }
      }
      return obj;
    });

    return Buffer.from(JSON.stringify(jsonArray, null, 2), 'utf-8');
  }
}
