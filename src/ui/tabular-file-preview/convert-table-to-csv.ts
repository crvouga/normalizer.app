const DEFAULT_MAX_ROWS = 5000;

/**
 * Converts tabular data to CSV format, with an optional limit on rows
 */

export function convertTableToCSV(
  tableData: Record<string, string | number | boolean | null | undefined>[],
  options?: { maxRows?: number },
): string {
  if (!tableData || tableData.length === 0) return '';

  // Get headers from first row
  const headers = Object.keys(tableData[0] ?? {});

  // Helper function to escape CSV field
  const escapeField = (value: string): string => {
    // Quote if field contains comma, quote, or newline
    if (
      value.includes(',') ||
      value.includes('"') ||
      value.includes('\n') ||
      value.includes('\r')
    ) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Create CSV rows
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.map((header) => escapeField(String(header))).join(','));

  // Determine how many rows to export
  const maxRows =
    options?.maxRows && options.maxRows > 0
      ? options.maxRows
      : DEFAULT_MAX_ROWS && tableData.length > DEFAULT_MAX_ROWS
        ? DEFAULT_MAX_ROWS
        : tableData.length;

  const rowsToExport = tableData.slice(0, maxRows);

  // Add data rows
  for (const row of rowsToExport) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return '';
      return escapeField(String(value));
    });
    csvRows.push(values.join(','));
  }

  return csvRows.join('\n');
}
