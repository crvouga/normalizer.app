import { deriveURL } from './url';
import { describe, expect, it } from 'bun:test';

describe('deriveURL', () => {
  it('returns null for empty string', () => {
    expect(deriveURL('')).toBeNull();
    expect(deriveURL('    ')).toBeNull();
  });

  it('returns null for non-string input', () => {
    expect(deriveURL(null)).toBeNull();
    expect(deriveURL(undefined)).toBeNull();
    expect(deriveURL(1234)).toBeNull();
    expect(deriveURL({})).toBeNull();
  });

  it('returns https://example.com/ for valid http URL', () => {
    expect(deriveURL('http://example.com')).toBe('https://example.com/');
  });

  it('returns https://example.com/ for valid https URL', () => {
    expect(deriveURL('https://example.com')).toBe('https://example.com/');
  });

  it('returns https://example.com/path?foo=bar for full URL with path and query', () => {
    expect(
      deriveURL('http://example.com/path?foo=bar')
    ).toBe('https://example.com/path?foo=bar');
    expect(
      deriveURL('https://example.com/path?foo=bar')
    ).toBe('https://example.com/path?foo=bar');
  });

  it('returns https://example.com/ for bare hostname', () => {
    expect(deriveURL('example.com')).toBe('https://example.com/');
    expect(deriveURL('example.com ')).toBe('https://example.com/');
  });

  it('returns https://example.com:3000/ for hostname with port', () => {
    expect(deriveURL('example.com:3000')).toBe('https://example.com:3000/');
  });

  it('returns https://foo-bar.com/ for dashed hostname', () => {
    expect(deriveURL('foo-bar.com')).toBe('https://foo-bar.com/');
  });

  it('returns https://example.com/path/to/thing for hostname with path', () => {
    expect(deriveURL('example.com/path/to/thing')).toBe('https://example.com/path/to/thing');
  });

  it('returns null for clearly invalid string', () => {
    expect(deriveURL('not a url')).toBeNull();
    expect(deriveURL('::::')).toBeNull();
    expect(deriveURL('http:///example.com')).toBeNull();
  });

  it('returns https://localhost/ for simple localhost', () => {
    expect(deriveURL('localhost')).toBe('https://localhost/');
    expect(deriveURL('http://localhost')).toBe('https://localhost/');
  });

  it('returns https://127.0.0.1/ for simple ip', () => {
    expect(deriveURL('127.0.0.1')).toBe('https://127.0.0.1/');
  });

  it('preserves search and hash', () => {
    expect(deriveURL('example.com/foo?bar=baz#section')).toBe(
      'https://example.com/foo?bar=baz#section'
    );
  });

  it('returns null for input with only punctuation', () => {
    expect(deriveURL('/////')).toBeNull();
  });
});

