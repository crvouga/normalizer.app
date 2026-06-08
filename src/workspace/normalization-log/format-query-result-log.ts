import type { QueryResultLogMeta } from './query-result-log-meta';

const MAX_STORED_ROWS = 25;
const MAX_STORED_COLUMNS = 15;
const MAX_CELL_LENGTH = 200;

function stringifyCellValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    return value.length > MAX_CELL_LENGTH ? `${value.slice(0, MAX_CELL_LENGTH)}…` : value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  const serialized = JSON.stringify(value);
  return serialized.length > MAX_CELL_LENGTH
    ? `${serialized.slice(0, MAX_CELL_LENGTH)}…`
    : serialized;
}

function truncateRows(rows: Record<string, unknown>[]): {
  rows: Record<string, string | number | boolean | null>[];
  totalRowCount: number;
  truncated: boolean;
} {
  const totalRowCount = rows.length;
  const truncated = totalRowCount > MAX_STORED_ROWS;
  const limitedRows = rows.slice(0, MAX_STORED_ROWS);

  const normalizedRows = limitedRows.map((row) => {
    const columns = Object.keys(row).slice(0, MAX_STORED_COLUMNS);
    return columns.reduce<Record<string, string | number | boolean | null>>((acc, column) => {
      acc[column] = stringifyCellValue(row[column]);
      return acc;
    }, {});
  });

  return {
    rows: normalizedRows,
    totalRowCount,
    truncated,
  };
}

function withQuery(
  formatted: { message: string; meta: QueryResultLogMeta },
  query?: string,
): { message: string; meta: QueryResultLogMeta } {
  if (!query) {
    return formatted;
  }

  return {
    ...formatted,
    meta: { ...formatted.meta, query },
  };
}

export function formatQueryResultLog(
  content: string,
  query?: string,
): { message: string; meta: QueryResultLogMeta } | null {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (typeof parsed.error === 'string' && parsed.error.length > 0) {
    return withQuery(
      {
        message: parsed.error,
        meta: {
          resultType: 'error',
          error: parsed.error,
        },
      },
      query,
    );
  }

  if (Array.isArray(parsed.rows)) {
    const rowRecords = parsed.rows.filter(
      (row): row is Record<string, unknown> => typeof row === 'object' && row !== null,
    );
    const { rows, totalRowCount, truncated } = truncateRows(rowRecords);

    return withQuery(
      {
        message: truncated
          ? `${totalRowCount} rows`
          : `${totalRowCount} ${totalRowCount === 1 ? 'row' : 'rows'}`,
        meta: {
          resultType: 'rows',
          rows,
          totalRowCount,
          truncated,
        },
      },
      query,
    );
  }

  if (typeof parsed.rowCount === 'number') {
    return withQuery(
      {
        message: `Command completed (${parsed.rowCount} rows affected)`,
        meta: {
          resultType: 'command',
          rowCount: parsed.rowCount,
        },
      },
      query,
    );
  }

  if ('result' in parsed) {
    return withQuery(
      {
        message: 'Query returned a result',
        meta: {
          resultType: 'generic',
          rawResult: parsed.result,
        },
      },
      query,
    );
  }

  return null;
}
