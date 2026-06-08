import { describe, expect, test } from 'bun:test';
import { formatQueryResultLog } from './format-query-result-log';

describe('formatQueryResultLog', () => {
  test('formats SELECT row results with truncation metadata', () => {
    const rows = Array.from({ length: 30 }, (_, index) => ({
      column_name: `col_${index}`,
    }));

    const formatted = formatQueryResultLog(JSON.stringify({ rows }));

    expect(formatted).not.toBeNull();
    expect(formatted!.meta.resultType).toBe('rows');
    expect(formatted!.meta.rows).toHaveLength(25);
    expect(formatted!.meta.totalRowCount).toBe(30);
    expect(formatted!.meta.truncated).toBe(true);
    expect(formatted!.message).toBe('30 rows');
  });

  test('formats CREATE VIEW command results', () => {
    const formatted = formatQueryResultLog(JSON.stringify({ rowCount: 0 }));

    expect(formatted).toEqual({
      message: 'Command completed (0 rows affected)',
      meta: {
        resultType: 'command',
        rowCount: 0,
      },
    });
  });

  test('formats query errors', () => {
    const formatted = formatQueryResultLog(
      JSON.stringify({ error: 'relation "missing" does not exist' }),
    );

    expect(formatted).toEqual({
      message: 'relation "missing" does not exist',
      meta: {
        resultType: 'error',
        error: 'relation "missing" does not exist',
      },
    });
  });

  test('formats generic tool results', () => {
    const formatted = formatQueryResultLog(JSON.stringify({ result: { ok: true } }));

    expect(formatted).toEqual({
      message: 'Query returned a result',
      meta: {
        resultType: 'generic',
        rawResult: { ok: true },
      },
    });
  });

  test('preserves query in meta when provided', () => {
    const formatted = formatQueryResultLog(
      JSON.stringify({ rows: [{ id: 1 }] }),
      'SELECT id FROM input_0;',
    );

    expect(formatted?.meta.query).toBe('SELECT id FROM input_0;');
  });

  test('stringifies and truncates long cell values', () => {
    const longValue = 'x'.repeat(250);
    const formatted = formatQueryResultLog(
      JSON.stringify({ rows: [{ note: longValue, count: 3 }] }),
    );

    expect(formatted?.meta.resultType).toBe('rows');
    expect(formatted?.meta.rows?.[0]?.note).toBe(`${'x'.repeat(200)}…`);
    expect(formatted?.meta.rows?.[0]?.count).toBe(3);
  });
});
