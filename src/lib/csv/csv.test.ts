import { describe, expect, it } from 'bun:test';
import { Csv } from './csv';

describe('CSV.parseLine', () => {
  it('parses simple CSV line without quotes', () => {
    expect(Csv.parseLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('parses CSV line with quoted values', () => {
    expect(Csv.parseLine('"a","b","c"')).toEqual(['a', 'b', 'c']);
  });

  it('parses CSV line with mixed quoted and unquoted values', () => {
    expect(Csv.parseLine('a,"b",c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted values containing commas', () => {
    expect(Csv.parseLine('"a,b","c,d"')).toEqual(['a,b', 'c,d']);
  });

  it('handles escaped quotes (double quotes)', () => {
    expect(Csv.parseLine('"a""b","c"')).toEqual(['a"b', 'c']);
  });

  it('handles empty fields', () => {
    expect(Csv.parseLine('a,,c')).toEqual(['a', '', 'c']);
  });

  it('handles all empty fields', () => {
    expect(Csv.parseLine(',,')).toEqual(['', '', '']);
  });

  it('handles single field', () => {
    expect(Csv.parseLine('a')).toEqual(['a']);
  });

  it('handles quoted empty field', () => {
    expect(Csv.parseLine('"",b')).toEqual(['', 'b']);
  });

  it('handles values with spaces', () => {
    expect(Csv.parseLine('a b, c d ,"e f"')).toEqual(['a b', ' c d ', 'e f']);
  });

  it('handles trailing comma', () => {
    expect(Csv.parseLine('a,b,')).toEqual(['a', 'b', '']);
  });

  it('handles leading comma', () => {
    expect(Csv.parseLine(',a,b')).toEqual(['', 'a', 'b']);
  });
});

describe('CSV.inferType', () => {
  it('returns text for empty array', () => {
    expect(Csv.inferColumnType([])).toBe('text');
  });

  it('infers boolean type', () => {
    expect(Csv.inferColumnType(['true', 'false'])).toBe('boolean');
    expect(Csv.inferColumnType(['yes', 'no'])).toBe('boolean');
    expect(Csv.inferColumnType(['y', 'n'])).toBe('boolean');
    expect(Csv.inferColumnType(['TRUE', 'FALSE'])).toBe('boolean');
    // Note: '1' and '0' are now inferred as integer, not boolean
    // This prevents false positives when numeric columns only have "1" in the sample
  });

  it('infers integer type', () => {
    expect(Csv.inferColumnType(['1', '2', '3'])).toBe('integer');
    expect(Csv.inferColumnType(['-1', '0', '100'])).toBe('integer');
    expect(Csv.inferColumnType(['123'])).toBe('integer');
  });

  it('infers numeric type for decimals', () => {
    expect(Csv.inferColumnType(['1.5', '2.3', '3.7'])).toBe('numeric');
    expect(Csv.inferColumnType(['-1.5', '0.0', '100.99'])).toBe('numeric');
    expect(Csv.inferColumnType(['.5', '.3'])).toBe('numeric');
    expect(Csv.inferColumnType(['1e5', '2.3e-2'])).toBe('numeric');
  });

  it('infers date type', () => {
    expect(Csv.inferColumnType(['2024-01-01', '2024-12-31'])).toBe('date');
    expect(Csv.inferColumnType(['2024-01-01'])).toBe('date');
  });

  it('infers timestamp type', () => {
    expect(Csv.inferColumnType(['2024-01-01 12:00:00', '2024-12-31 23:59:59'])).toBe('timestamp');
    expect(Csv.inferColumnType(['2024-01-01T12:00:00', '2024-12-31T23:59:59'])).toBe('timestamp');
    expect(Csv.inferColumnType(['2024-01-01 12:00:00'])).toBe('timestamp');
  });

  it('returns text for mixed types', () => {
    expect(Csv.inferColumnType(['1', 'abc', '3'])).toBe('text');
    expect(Csv.inferColumnType(['1.5', 'abc'])).toBe('text');
    expect(Csv.inferColumnType(['true', 'maybe'])).toBe('text');
  });

  it('returns text for non-matching patterns', () => {
    expect(Csv.inferColumnType(['abc', 'def'])).toBe('text');
    expect(Csv.inferColumnType(['123abc', '456def'])).toBe('text');
  });

  it('prefers integer over boolean for numeric values', () => {
    // Numeric values like '1' and '0' are now inferred as integer
    // This prevents false positives when the sample only contains "1" but the full dataset has "2"
    expect(Csv.inferColumnType(['1', '0'])).toBe('integer');
    expect(Csv.inferColumnType(['1', '2', '3'])).toBe('integer');
  });
});

describe('CSV.parse', () => {
  it('parses simple CSV with headers and data', () => {
    const csv = 'name,age,city\nJohn,30,New York\nJane,25,London';
    const result = Csv.parse(csv);

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
    const result = Csv.parse('');
    expect(result.schema).toEqual([]);
    expect(result.dataRows).toEqual([]);
    expect(result.headers).toEqual([]);
  });

  it('handles CSV with only headers', () => {
    const csv = 'name,age,city';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'age', 'city']);
    expect(result.schema).toHaveLength(3);
    expect(result.dataRows).toEqual([]);
  });

  it('handles CSV with empty lines', () => {
    const csv = 'name,age\nJohn,30\n\nJane,25\n';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'age']);
    expect(result.dataRows).toEqual([
      ['John', '30'],
      ['Jane', '25'],
    ]);
  });

  it('handles CSV with quoted values', () => {
    const csv = 'name,description\nJohn,"A person"\nJane,"Another person"';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'description']);
    expect(result.dataRows).toEqual([
      ['John', 'A person'],
      ['Jane', 'Another person'],
    ]);
  });

  it('handles CSV with quoted values containing commas', () => {
    const csv = 'name,address\nJohn,"123 Main St, New York"\nJane,"456 Oak Ave, London"';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'address']);
    expect(result.dataRows).toEqual([
      ['John', '123 Main St, New York'],
      ['Jane', '456 Oak Ave, London'],
    ]);
  });

  it('handles CSV with missing values (empty fields)', () => {
    const csv = 'name,age,city\nJohn,30,\nJane,,London\n,25,Paris';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'age', 'city']);
    expect(result.dataRows).toEqual([
      ['John', '30', ''],
      ['Jane', '', 'London'],
      ['', '25', 'Paris'],
    ]);
  });

  it('pads rows shorter than headers', () => {
    const csv = 'name,age,city\nJohn,30\nJane';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'age', 'city']);
    expect(result.dataRows).toEqual([
      ['John', '30', ''],
      ['Jane', '', ''],
    ]);
  });

  it('truncates rows longer than headers', () => {
    const csv = 'name,age\nJohn,30,extra,fields\nJane,25';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'age']);
    expect(result.dataRows).toEqual([
      ['John', '30'],
      ['Jane', '25'],
    ]);
  });

  it('infers correct column types', () => {
    const csv =
      'name,age,price,active,created_at\nJohn,30,19.99,true,2024-01-01\nJane,25,29.99,false,2024-01-02';
    const result = Csv.parse(csv);

    expect(result.schema[0]).toEqual({ name: 'name', type: 'text', nullable: true });
    expect(result.schema[1]).toEqual({ name: 'age', type: 'integer', nullable: true });
    expect(result.schema[2]).toEqual({ name: 'price', type: 'numeric', nullable: true });
    expect(result.schema[3]).toEqual({ name: 'active', type: 'boolean', nullable: true });
    expect(result.schema[4]).toEqual({ name: 'created_at', type: 'date', nullable: true });
  });

  it('infers timestamp type for datetime values', () => {
    const csv = 'event,time\nEvent1,2024-01-01 12:00:00\nEvent2,2024-01-02 13:30:00';
    const result = Csv.parse(csv);

    const timeSchema = result.schema[1];
    expect(timeSchema).toBeDefined();
    if (timeSchema) {
      expect(timeSchema).toEqual({ name: 'time', type: 'timestamp', nullable: true });
    }
  });

  it('infers timestamp type for ISO datetime values', () => {
    const csv = 'event,time\nEvent1,2024-01-01T12:00:00\nEvent2,2024-01-02T13:30:00';
    const result = Csv.parse(csv);

    const timeSchema = result.schema[1];
    expect(timeSchema).toBeDefined();
    if (timeSchema) {
      expect(timeSchema).toEqual({ name: 'time', type: 'timestamp', nullable: true });
    }
  });

  it('handles CSV with whitespace in headers', () => {
    const csv = ' name , age , city \nJohn,30,New York';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'age', 'city']);
  });

  it('uses sanitizeIdentifier when provided', () => {
    const csv = 'my-name,my age,my_city\nJohn,30,New York';
    const sanitize = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, '_');
    const result = Csv.parse(csv, sanitize);

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
    const result = Csv.parse(csv);

    // Should infer integer type based on first 1000 rows
    expect(result.schema[0]).toBeDefined();
    if (result.schema[0]) {
      expect(result.schema[0].type).toBe('integer');
    }
    expect(result.dataRows).toHaveLength(1500);
  });

  it('handles CSV with single column', () => {
    const csv = 'name\nJohn\nJane';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name']);
    expect(result.schema).toHaveLength(1);
    expect(result.dataRows).toEqual([['John'], ['Jane']]);
  });

  it('handles CSV with single row of data', () => {
    const csv = 'name,age\nJohn,30';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'age']);
    expect(result.dataRows).toEqual([['John', '30']]);
  });

  it('handles CSV with trailing newline', () => {
    const csv = 'name,age\nJohn,30\n';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'age']);
    expect(result.dataRows).toEqual([['John', '30']]);
  });

  it('handles CSV with Windows line endings (CRLF)', () => {
    // Note: The parser splits on '\n' only, so '\r' characters remain in values
    // This is expected behavior - the parser handles Unix-style line endings
    const csv = 'name,age\r\nJohn,30\r\nJane,25';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'age']);
    // The '\r' character remains in the values since we split on '\n' only
    expect(result.dataRows[0]).toEqual(['John', '30\r']);
    expect(result.dataRows[1]).toEqual(['Jane', '25']);
  });

  it('handles mixed line endings', () => {
    const csv = 'name,age\nJohn,30\r\nJane,25';
    const result = Csv.parse(csv);

    expect(result.headers).toEqual(['name', 'age']);
    expect(result.dataRows.length).toBeGreaterThan(0);
  });
});

describe('Csv.of', () => {
  it('converts array of objects to CSV string', () => {
    const data = [
      { name: 'John', age: 30, city: 'New York' },
      { name: 'Jane', age: 25, city: 'London' },
    ];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,age,city\nJohn,30,New York\nJane,25,London');
  });

  it('returns empty string for empty array', () => {
    const result = Csv.of([]).toString();
    expect(result).toBe('');
  });

  it('handles single object', () => {
    const data = [{ name: 'John', age: 30 }];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,age\nJohn,30');
  });

  it('handles null and undefined values', () => {
    const data = [
      { name: 'John', age: null, city: undefined },
      { name: 'Jane', age: 25, city: 'London' },
    ];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,age,city\nJohn,,\nJane,25,London');
  });

  it('escapes values containing commas', () => {
    const data = [
      { name: 'John', address: '123 Main St, New York' },
      { name: 'Jane', address: '456 Oak Ave, London' },
    ];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,address\nJohn,"123 Main St, New York"\nJane,"456 Oak Ave, London"');
  });

  it('escapes values containing quotes', () => {
    const data = [
      { name: 'John', quote: 'He said "Hello"' },
      { name: 'Jane', quote: 'She said "Hi"' },
    ];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,quote\nJohn,"He said ""Hello"""\nJane,"She said ""Hi"""');
  });

  it('escapes values containing newlines', () => {
    const data = [
      { name: 'John', description: 'Line 1\nLine 2' },
      { name: 'Jane', description: 'Single line' },
    ];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,description\nJohn,"Line 1\nLine 2"\nJane,Single line');
  });

  it('handles values with multiple special characters', () => {
    const data = [{ name: 'John', text: 'Value with, "quotes" and\nnewlines' }];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,text\nJohn,"Value with, ""quotes"" and\nnewlines"');
  });

  it('handles numeric values', () => {
    const data = [
      { name: 'John', age: 30, price: 19.99 },
      { name: 'Jane', age: 25, price: 29.99 },
    ];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,age,price\nJohn,30,19.99\nJane,25,29.99');
  });

  it('handles boolean values', () => {
    const data = [
      { name: 'John', active: true },
      { name: 'Jane', active: false },
    ];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,active\nJohn,true\nJane,false');
  });

  it('uses keys from first object only', () => {
    const data = [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25, extra: 'ignored' },
    ];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,age\nJohn,30\nJane,25');
  });

  it('handles empty string values', () => {
    const data = [
      { name: 'John', description: '' },
      { name: 'Jane', description: 'Has description' },
    ];
    const result = Csv.of(data).toString();

    expect(result).toBe('name,description\nJohn,\nJane,Has description');
  });

  it('withHeader: allows specifying headers for empty array', () => {
    const result = Csv.of([]).withHeader(['name', 'age', 'city']).toString();
    expect(result).toBe('name,age,city');
  });

  it('withHeader: overrides headers from data when specified', () => {
    const data = [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 },
    ];
    const result = Csv.of(data).withHeader(['first_name', 'years']).toString();
    expect(result).toBe('first_name,years\nJohn,30\nJane,25');
  });

  it('withHeader: handles headers with more columns than data', () => {
    const data = [{ name: 'John', age: 30 }];
    const result = Csv.of(data).withHeader(['name', 'age', 'city', 'country']).toString();
    expect(result).toBe('name,age,city,country\nJohn,30,,');
  });

  it('withHeader: handles headers with fewer columns than data', () => {
    const data = [{ name: 'John', age: 30, city: 'New York', country: 'USA' }];
    const result = Csv.of(data).withHeader(['name', 'age']).toString();
    expect(result).toBe('name,age\nJohn,30');
  });
});
