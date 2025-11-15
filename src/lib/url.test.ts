import { describe, expect, it } from 'bun:test';
import { parseAndValidateURL } from './url';

describe('parseAndValidateURL', () => {
  it('parses and returns valid http and https URLs unchanged (normalized)', () => {
    expect(parseAndValidateURL('https://example.com')).toBe('https://example.com/');
    expect(parseAndValidateURL('http://example.com')).toBe('http://example.com/');
    expect(parseAndValidateURL('https://example.com:5000/path')).toBe(
      'https://example.com:5000/path',
    );
  });

  it('trims and parses input', () => {
    expect(parseAndValidateURL('  http://foo.com/bar ')).toBe('http://foo.com/bar');
  });

  it('throws if missing host', () => {
    expect(() => parseAndValidateURL('http:///')).toThrow(/missing host/i);
    expect(() => parseAndValidateURL('https:///foo/bar')).toThrow(/missing host/i);
  });

  it('parses input missing protocol by assuming http://', () => {
    expect(parseAndValidateURL('localhost:9000')).toBe('http://localhost:9000/');
    expect(parseAndValidateURL('127.0.0.1:3000')).toBe('http://127.0.0.1:3000/');
    expect(parseAndValidateURL('Example.com')).toBe('http://example.com/');
  });

  it('accepts Docker service names as valid hostnames', () => {
    expect(parseAndValidateURL('http://s3:9000')).toBe('http://s3:9000/');
    expect(parseAndValidateURL('http://db:5432')).toBe('http://db:5432/');
    expect(parseAndValidateURL('http://my-service')).toBe('http://my-service/');
    expect(parseAndValidateURL('redis')).toBe('http://redis/');
  });

  it('throws for completely invalid URLs', () => {
    expect(() => parseAndValidateURL('not-a-url!!!')).toThrow(/Must be a valid URL/);
    expect(() => parseAndValidateURL('///')).toThrow(/Must be a valid URL/);
    expect(() => parseAndValidateURL('::::')).toThrow(/Must be a valid URL/);
  });

  it('keeps path, search, and hash intact', () => {
    expect(parseAndValidateURL('localhost:9000/foo/bar?x=1#frag')).toBe(
      'http://localhost:9000/foo/bar?x=1#frag',
    );
    expect(parseAndValidateURL('http://example.com/a/b?c=d#hi')).toBe(
      'http://example.com/a/b?c=d#hi',
    );
  });

  it('throws with proper prefix', () => {
    expect(() => parseAndValidateURL('not-a-url!!!', 'MyError')).toThrow(/MyError:/);
  });
});
