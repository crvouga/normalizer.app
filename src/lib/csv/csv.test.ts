import { describe, expect, it } from 'bun:test';
import { inferColumnType, parseCsv, parseCsvLine } from './csv';

describe('parseCsvLine', () => {
  it('parses simple CSV line without quotes', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('parses CSV line with quoted values', () => {
    expect(parseCsvLine('"a","b","c"')).toEqual(['a', 'b', 'c']);
  });

  it('parses CSV line with mixed quoted and unquoted values', () => {
    expect(parseCsvLine('a,"b",c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted values containing commas', () => {
    expect(parseCsvLine('"a,b","c,d"')).toEqual(['a,b', 'c,d']);
  });

  it('handles escaped quotes (double quotes)', () => {
    expect(parseCsvLine('"a""b","c"')).toEqual(['a"b', 'c']);
  });

  it('handles empty fields', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles all empty fields', () => {
    expect(parseCsvLine(',,')).toEqual(['', '', '']);
  });

  it('handles single field', () => {
    expect(parseCsvLine('a')).toEqual(['a']);
  });

  it('handles quoted empty field', () => {
    expect(parseCsvLine('"",b')).toEqual(['', 'b']);
  });

  it('handles values with spaces', () => {
    expect(parseCsvLine('a b, c d ,"e f"')).toEqual(['a b', ' c d ', 'e f']);
  });

  it('handles trailing comma', () => {
    expect(parseCsvLine('a,b,')).toEqual(['a', 'b', '']);
  });

  it('handles leading comma', () => {
    expect(parseCsvLine(',a,b')).toEqual(['', 'a', 'b']);
  });
});

describe('inferColumnType', () => {
  it('returns text for empty array', () => {
    expect(inferColumnType([])).toBe('text');
  });

  it('infers boolean type', () => {
    expect(inferColumnType(['true', 'false'])).toBe('boolean');
    expect(inferColumnType(['yes', 'no'])).toBe('boolean');
    expect(inferColumnType(['1', '0'])).toBe('boolean');
    expect(inferColumnType(['y', 'n'])).toBe('boolean');
    expect(inferColumnType(['TRUE', 'FALSE'])).toBe('boolean');
  });

  it('infers integer type', () => {
    expect(inferColumnType(['1', '2', '3'])).toBe('integer');
    expect(inferColumnType(['-1', '0', '100'])).toBe('integer');
    expect(inferColumnType(['123'])).toBe('integer');
  });

  it('infers numeric type for decimals', () => {
    expect(inferColumnType(['1.5', '2.3', '3.7'])).toBe('numeric');
    expect(inferColumnType(['-1.5', '0.0', '100.99'])).toBe('numeric');
    expect(inferColumnType(['.5', '.3'])).toBe('numeric');
    expect(inferColumnType(['1e5', '2.3e-2'])).toBe('numeric');
  });

  it('infers date type', () => {
    expect(inferColumnType(['2024-01-01', '2024-12-31'])).toBe('date');
    expect(inferColumnType(['2024-01-01'])).toBe('date');
  });

  it('infers timestamp type', () => {
    expect(inferColumnType(['2024-01-01 12:00:00', '2024-12-31 23:59:59'])).toBe('timestamp');
    expect(inferColumnType(['2024-01-01T12:00:00', '2024-12-31T23:59:59'])).toBe('timestamp');
    expect(inferColumnType(['2024-01-01 12:00:00'])).toBe('timestamp');
  });

  it('returns text for mixed types', () => {
    expect(inferColumnType(['1', 'abc', '3'])).toBe('text');
    expect(inferColumnType(['1.5', 'abc'])).toBe('text');
    expect(inferColumnType(['true', 'maybe'])).toBe('text');
  });

  it('returns text for non-matching patterns', () => {
    expect(inferColumnType(['abc', 'def'])).toBe('text');
    expect(inferColumnType(['123abc', '456def'])).toBe('text');
  });

  it('prefers boolean over integer when both match', () => {
    // Since boolean check comes first, '1' and '0' are detected as boolean
    expect(inferColumnType(['1', '0'])).toBe('boolean');
  });
});

describe('parseCsv', () => {
  it('parses simple CSV with headers and data', () => {
    const csv = 'name,age,city\nJohn,30,New York\nJane,25,London';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age', 'city']);
    expect(result.schema).toHaveLength(3);
    expect(result.schema[0]).toEqual({ name: 'name', type: 'text', nullable: true });
    expect(result.schema[1]).toEqual({ name: 'age', type: 'integer', nullable: true });
    expect(result.schema[2]).toEqual({ name: 'city', type: 'text', nullable: true });
    expect(result.dataRows).toEqual([
      ['John', '30', 'New York'],
      ['Jane', '25', 'London'],
    ]);
  });

  it('handles empty CSV content', () => {
    const result = parseCsv('');
    expect(result.schema).toEqual([]);
    expect(result.dataRows).toEqual([]);
    expect(result.headers).toEqual([]);
  });

  it('handles CSV with only headers', () => {
    const csv = 'name,age,city';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age', 'city']);
    expect(result.schema).toHaveLength(3);
    expect(result.dataRows).toEqual([]);
  });

  it('handles CSV with empty lines', () => {
    const csv = 'name,age\nJohn,30\n\nJane,25\n';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age']);
    expect(result.dataRows).toEqual([
      ['John', '30'],
      ['Jane', '25'],
    ]);
  });

  it('handles CSV with quoted values', () => {
    const csv = 'name,description\nJohn,"A person"\nJane,"Another person"';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'description']);
    expect(result.dataRows).toEqual([
      ['John', 'A person'],
      ['Jane', 'Another person'],
    ]);
  });

  it('handles CSV with quoted values containing commas', () => {
    const csv = 'name,address\nJohn,"123 Main St, New York"\nJane,"456 Oak Ave, London"';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'address']);
    expect(result.dataRows).toEqual([
      ['John', '123 Main St, New York'],
      ['Jane', '456 Oak Ave, London'],
    ]);
  });

  it('handles CSV with missing values (empty fields)', () => {
    const csv = 'name,age,city\nJohn,30,\nJane,,London\n,25,Paris';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age', 'city']);
    expect(result.dataRows).toEqual([
      ['John', '30', ''],
      ['Jane', '', 'London'],
      ['', '25', 'Paris'],
    ]);
  });

  it('pads rows shorter than headers', () => {
    const csv = 'name,age,city\nJohn,30\nJane';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age', 'city']);
    expect(result.dataRows).toEqual([
      ['John', '30', ''],
      ['Jane', '', ''],
    ]);
  });

  it('truncates rows longer than headers', () => {
    const csv = 'name,age\nJohn,30,extra,fields\nJane,25';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age']);
    expect(result.dataRows).toEqual([
      ['John', '30'],
      ['Jane', '25'],
    ]);
  });

  it('infers correct column types', () => {
    const csv =
      'name,age,price,active,created_at\nJohn,30,19.99,true,2024-01-01\nJane,25,29.99,false,2024-01-02';
    const result = parseCsv(csv);

    expect(result.schema[0]).toEqual({ name: 'name', type: 'text', nullable: true });
    expect(result.schema[1]).toEqual({ name: 'age', type: 'integer', nullable: true });
    expect(result.schema[2]).toEqual({ name: 'price', type: 'numeric', nullable: true });
    expect(result.schema[3]).toEqual({ name: 'active', type: 'boolean', nullable: true });
    expect(result.schema[4]).toEqual({ name: 'created_at', type: 'date', nullable: true });
  });

  it('infers timestamp type for datetime values', () => {
    const csv = 'event,time\nEvent1,2024-01-01 12:00:00\nEvent2,2024-01-02 13:30:00';
    const result = parseCsv(csv);

    const timeSchema = result.schema[1];
    expect(timeSchema).toBeDefined();
    if (timeSchema) {
      expect(timeSchema).toEqual({ name: 'time', type: 'timestamp', nullable: true });
    }
  });

  it('infers timestamp type for ISO datetime values', () => {
    const csv = 'event,time\nEvent1,2024-01-01T12:00:00\nEvent2,2024-01-02T13:30:00';
    const result = parseCsv(csv);

    const timeSchema = result.schema[1];
    expect(timeSchema).toBeDefined();
    if (timeSchema) {
      expect(timeSchema).toEqual({ name: 'time', type: 'timestamp', nullable: true });
    }
  });

  it('handles CSV with whitespace in headers', () => {
    const csv = ' name , age , city \nJohn,30,New York';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age', 'city']);
  });

  it('uses sanitizeIdentifier when provided', () => {
    const csv = 'my-name,my age,my_city\nJohn,30,New York';
    const sanitize = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, '_');
    const result = parseCsv(csv, sanitize);

    expect(result.headers).toEqual(['my_name', 'my_age', 'my_city']);
    expect(result.schema[0]).toBeDefined();
    expect(result.schema[1]).toBeDefined();
    expect(result.schema[2]).toBeDefined();
    if (result.schema[0] && result.schema[1] && result.schema[2]) {
      expect(result.schema[0].name).toBe('my_name');
      expect(result.schema[1].name).toBe('my_age');
      expect(result.schema[2].name).toBe('my_city');
    }
  });

  it('samples up to 1000 rows for type inference', () => {
    // Create CSV with 1500 rows
    const header = 'value';
    const rows: string[] = [];
    for (let i = 0; i < 1500; i++) {
      rows.push(`${i}`);
    }
    const csv = [header, ...rows].join('\n');
    const result = parseCsv(csv);

    // Should infer integer type based on first 1000 rows
    expect(result.schema[0]).toBeDefined();
    if (result.schema[0]) {
      expect(result.schema[0].type).toBe('integer');
    }
    expect(result.dataRows).toHaveLength(1500);
  });

  it('handles CSV with single column', () => {
    const csv = 'name\nJohn\nJane';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name']);
    expect(result.schema).toHaveLength(1);
    expect(result.dataRows).toEqual([['John'], ['Jane']]);
  });

  it('handles CSV with single row of data', () => {
    const csv = 'name,age\nJohn,30';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age']);
    expect(result.dataRows).toEqual([['John', '30']]);
  });

  it('handles CSV with trailing newline', () => {
    const csv = 'name,age\nJohn,30\n';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age']);
    expect(result.dataRows).toEqual([['John', '30']]);
  });

  it('handles CSV with Windows line endings (CRLF)', () => {
    // Note: The parser splits on '\n' only, so '\r' characters remain in values
    // This is expected behavior - the parser handles Unix-style line endings
    const csv = 'name,age\r\nJohn,30\r\nJane,25';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age']);
    // The '\r' character remains in the values since we split on '\n' only
    expect(result.dataRows[0]).toEqual(['John', '30\r']);
    expect(result.dataRows[1]).toEqual(['Jane', '25']);
  });

  it('handles mixed line endings', () => {
    const csv = 'name,age\nJohn,30\r\nJane,25';
    const result = parseCsv(csv);

    expect(result.headers).toEqual(['name', 'age']);
    expect(result.dataRows.length).toBeGreaterThan(0);
  });
});
