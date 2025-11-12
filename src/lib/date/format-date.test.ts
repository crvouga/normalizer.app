import { describe, expect, it } from 'bun:test';
import { formatDate } from './format-date';

describe('formatDate', () => {
  describe('Valid Date inputs', () => {
    it('should format a valid Date object', () => {
      const date = new Date('2025-11-12T15:30:00Z');
      const result = formatDate(date);
      // The result will vary based on timezone, but it should contain the expected parts
      expect(result).toContain('2025');
      expect(result).toContain('Nov');
      expect(result).toContain('12');
      expect(result).not.toBe('Invalid date');
    });

    it('should format a date at midnight', () => {
      const date = new Date('2025-11-12T00:00:00Z');
      const result = formatDate(date);
      expect(result).toContain('2025');
      expect(result).toContain('Nov');
      expect(result).toContain('12');
      expect(result).not.toBe('Invalid date');
    });

    it('should format a date at the end of the day', () => {
      const date = new Date('2025-11-12T23:59:59Z');
      const result = formatDate(date);
      expect(result).toContain('2025');
      expect(result).toContain('Nov');
      expect(result).not.toBe('Invalid date');
    });
  });

  describe('Valid string inputs', () => {
    it('should format a valid ISO date string', () => {
      const result = formatDate('2025-11-12T15:30:00Z');
      expect(result).toContain('2025');
      expect(result).toContain('Nov');
      expect(result).toContain('12');
      expect(result).not.toBe('Invalid date');
    });

    it('should format a valid date string without time', () => {
      const result = formatDate('2025-11-12');
      expect(result).toContain('2025');
      expect(result).toContain('Nov');
      expect(result).toContain('12');
      expect(result).not.toBe('Invalid date');
    });

    it('should format a date string in different format', () => {
      const result = formatDate('November 12, 2025');
      expect(result).toContain('2025');
      expect(result).toContain('Nov');
      expect(result).toContain('12');
      expect(result).not.toBe('Invalid date');
    });
  });

  describe('Valid number inputs (timestamps)', () => {
    it('should format a valid timestamp (milliseconds)', () => {
      const timestamp = new Date('2025-11-12T15:30:00Z').getTime();
      const result = formatDate(timestamp);
      expect(result).toContain('2025');
      expect(result).toContain('Nov');
      expect(result).toContain('12');
      expect(result).not.toBe('Invalid date');
    });

    it('should format timestamp 0 (Unix epoch)', () => {
      const result = formatDate(0);
      expect(result).toContain('1970');
      expect(result).toContain('Jan');
      expect(result).toContain('1');
      expect(result).not.toBe('Invalid date');
    });

    it('should format a negative timestamp', () => {
      const result = formatDate(-86400000); // One day before epoch
      expect(result).toContain('1969');
      expect(result).toContain('Dec');
      expect(result).toContain('31');
      expect(result).not.toBe('Invalid date');
    });
  });

  describe('Invalid inputs', () => {
    it('should return "Invalid date" for an invalid Date object', () => {
      const invalidDate = new Date('invalid');
      const result = formatDate(invalidDate);
      expect(result).toBe('Invalid date');
    });

    it('should return "Invalid date" for an invalid string', () => {
      const result = formatDate('not a date');
      expect(result).toBe('Invalid date');
    });

    it('should return "Invalid date" for null', () => {
      const result = formatDate(null);
      expect(result).toBe('Invalid date');
    });

    it('should return "Invalid date" for undefined', () => {
      const result = formatDate(undefined);
      expect(result).toBe('Invalid date');
    });

    it('should return "Invalid date" for an empty string', () => {
      const result = formatDate('');
      expect(result).toBe('Invalid date');
    });

    it('should return "Invalid date" for an object', () => {
      const result = formatDate({ date: '2025-11-12' });
      expect(result).toBe('Invalid date');
    });

    it('should return "Invalid date" for an array', () => {
      const result = formatDate([2025, 11, 12]);
      expect(result).toBe('Invalid date');
    });

    it('should return "Invalid date" for a boolean', () => {
      expect(formatDate(true)).toBe('Invalid date');
      expect(formatDate(false)).toBe('Invalid date');
    });

    it('should return "Invalid date" for NaN', () => {
      const result = formatDate(NaN);
      expect(result).toBe('Invalid date');
    });

    it('should return "Invalid date" for Infinity', () => {
      const result = formatDate(Infinity);
      expect(result).toBe('Invalid date');
    });
  });

  describe('Edge cases', () => {
    it('should handle very old dates', () => {
      const result = formatDate('1900-01-01');
      expect(result).toContain('1900');
      expect(result).toContain('Jan');
      expect(result).toContain('1');
      expect(result).not.toBe('Invalid date');
    });

    it('should handle far future dates', () => {
      const result = formatDate('2999-12-31');
      expect(result).toContain('2999');
      expect(result).toContain('Dec');
      expect(result).toContain('31');
      expect(result).not.toBe('Invalid date');
    });

    it('should handle leap year dates', () => {
      const result = formatDate('2024-02-29'); // 2024 is a leap year
      expect(result).toContain('2024');
      expect(result).toContain('Feb');
      expect(result).toContain('29');
      expect(result).not.toBe('Invalid date');
    });
  });

  describe('Format consistency', () => {
    it('should include month abbreviation', () => {
      const result = formatDate('2025-11-12');
      expect(result).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    });

    it('should include year as 4 digits', () => {
      const result = formatDate('2025-11-12');
      expect(result).toMatch(/\d{4}/);
    });

    it('should include day number', () => {
      const result = formatDate('2025-11-12');
      expect(result).toMatch(/\d{1,2}/);
    });

    it('should include time information', () => {
      const result = formatDate('2025-11-12T15:30:00Z');
      // Should contain hour and minute
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });
});
