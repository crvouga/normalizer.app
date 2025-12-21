import { describe, expect, it } from 'bun:test';
import {
  TABULAR_FORMATS,
  getAllFormats,
  getContentType,
  getDisplayName,
  getExtension,
  getFormatFromKey,
  getFormatMetadata,
  getName,
  isValidFormat,
  normalizeFormat,
} from './tabular-data-format';

describe('tabular-data-format', () => {
  describe('TABULAR_FORMATS', () => {
    it('should contain expected formats', () => {
      expect(TABULAR_FORMATS).toMatchObject({
        CSV: 'csv',
        EXCEL: 'excel',
        PARQUET: 'parquet',
        JSON: 'json',
      });
    });
  });

  describe('getFormatMetadata', () => {
    it('should return correct metadata for "csv"', () => {
      const metadata = getFormatMetadata('csv');
      expect(metadata).toMatchObject({
        name: 'csv',
        contentType: 'text/csv',
        extension: 'csv',
        displayName: 'CSV',
      });
    });

    it('should support alias ("xlsx" -> excel)', () => {
      const metadata = getFormatMetadata('xlsx');
      expect(metadata?.name).toBe('excel');
      expect(metadata?.extension).toBe('xlsx');
    });

    it('should return undefined for unknown format', () => {
      expect(getFormatMetadata('foobar')).toBeUndefined();
    });
  });

  describe('normalizeFormat', () => {
    it('should normalize format names and aliases', () => {
      expect(normalizeFormat('csv')).toBe('csv');
      expect(normalizeFormat('CSV')).toBe('csv');
      expect(normalizeFormat('xlsx')).toBe('excel');
      expect(normalizeFormat('excel')).toBe('excel');
      expect(normalizeFormat('parquet')).toBe('parquet');
      expect(normalizeFormat('json')).toBe('json');
    });

    it('should return undefined for unknown formats', () => {
      expect(normalizeFormat('foobar')).toBeUndefined();
    });
  });

  describe('getContentType', () => {
    it('should return correct content types', () => {
      expect(getContentType('csv')).toBe('text/csv');
      expect(getContentType('xlsx')).toBe(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      expect(getContentType('parquet')).toBe('application/parquet');
      expect(getContentType('json')).toBe('application/json');
    });

    it('should return default for unknown', () => {
      expect(getContentType('foobar')).toBe('application/octet-stream');
    });
  });

  describe('getExtension', () => {
    it('should return correct file extension', () => {
      expect(getExtension('csv')).toBe('csv');
      expect(getExtension('excel')).toBe('xlsx');
      expect(getExtension('xlsx')).toBe('xlsx');
      expect(getExtension('parquet')).toBe('parquet');
      expect(getExtension('json')).toBe('json');
    });

    it('should return empty string for unknown format', () => {
      expect(getExtension('foobar')).toBe('');
    });
  });

  describe('getDisplayName', () => {
    it('should return correct display names', () => {
      expect(getDisplayName('csv')).toBe('CSV');
      expect(getDisplayName('excel')).toBe('Excel');
      expect(getDisplayName('xlsx')).toBe('Excel');
      expect(getDisplayName('json')).toBe('JSON');
    });

    it('should return original string for unknown', () => {
      expect(getDisplayName('foobar')).toBe('foobar');
    });
  });

  describe('getName', () => {
    it('should return canonical format name', () => {
      expect(getName('csv')).toBe('csv');
      expect(getName('xlsx')).toBe('excel');
      expect(getName('excel')).toBe('excel');
    });

    it('should return original for unknown', () => {
      expect(getName('foobar')).toBe('foobar');
    });
  });

  describe('isValidFormat', () => {
    it('should validate format and aliases', () => {
      expect(isValidFormat('csv')).toBe(true);
      expect(isValidFormat('excel')).toBe(true);
      expect(isValidFormat('xlsx')).toBe(true);
      expect(isValidFormat('json')).toBe(true);
      expect(isValidFormat('parquet')).toBe(true);
    });

    it('should return false for unknown', () => {
      expect(isValidFormat('foobar')).toBe(false);
    });
  });

  describe('getAllFormats', () => {
    it('should return all canonical format names', () => {
      const formats = getAllFormats();
      expect(formats).toEqual(expect.arrayContaining(['csv', 'excel', 'parquet', 'json']));
    });
  });

  describe('getFormatFromKey', () => {
    it('should detect format from file extension', () => {
      expect(getFormatFromKey('foo.csv')).toBe('csv');
      expect(getFormatFromKey('foo.XLSX')).toBe('excel');
      expect(getFormatFromKey('foo.parquet')).toBe('parquet');
      expect(getFormatFromKey('foo.json')).toBe('json');
    });

    it('should default to csv if extension is unknown', () => {
      expect(getFormatFromKey('foo.unknown')).toBe('csv');
      expect(getFormatFromKey('foo')).toBe('csv');
    });

    it('should handle multiple dots in key', () => {
      expect(getFormatFromKey('bar.data.xlsx')).toBe('excel');
    });
  });
});
