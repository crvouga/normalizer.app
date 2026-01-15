import { describe, expect, it } from 'bun:test';
import { toNormalizedFileName } from './normalized-file-name';

describe('toNormalizedFileName', () => {
  it('appends _NORMALIZED before extension if not present', () => {
    expect(toNormalizedFileName('document.pdf')).toBe('document_NORMALIZED.pdf');
    expect(toNormalizedFileName('report')).toBe('report_NORMALIZED');
    expect(toNormalizedFileName('archive.tar.gz')).toBe('archive.tar_NORMALIZED.gz');
  });

  it('increments _NORMALIZED to _NORMALIZED_2 if already present', () => {
    expect(toNormalizedFileName('file_NORMALIZED.pdf')).toBe('file_NORMALIZED_2.pdf');
    expect(toNormalizedFileName('test_NORMALIZED')).toBe('test_NORMALIZED_2');
    expect(toNormalizedFileName('summary_NORMALIZED.txt')).toBe('summary_NORMALIZED_2.txt');
  });

  it('increments _NORMALIZED_N to _NORMALIZED_{N+1} if numeric suffix exists', () => {
    expect(toNormalizedFileName('file_NORMALIZED_2.pdf')).toBe('file_NORMALIZED_3.pdf');
    expect(toNormalizedFileName('sample_NORMALIZED_99.txt')).toBe('sample_NORMALIZED_100.txt');
    expect(toNormalizedFileName('noext_NORMALIZED_7')).toBe('noext_NORMALIZED_8');
  });

  it('handles files with multiple dots', () => {
    expect(toNormalizedFileName('archive.backup.tar.gz')).toBe('archive.backup.tar_NORMALIZED.gz');
    expect(toNormalizedFileName('archive.backup.tar_NORMALIZED.gz')).toBe(
      'archive.backup.tar_NORMALIZED_2.gz',
    );
    expect(toNormalizedFileName('archive.backup.tar_NORMALIZED_4.gz')).toBe(
      'archive.backup.tar_NORMALIZED_5.gz',
    );
  });

  it('does not increment when _NORMALIZED is not at the end', () => {
    expect(toNormalizedFileName('my_NORMALIZED_file.pdf')).toBe(
      'my_NORMALIZED_file_NORMALIZED.pdf',
    );
  });

  it('returns sensible results for edge cases', () => {
    expect(toNormalizedFileName('')).toBe('_NORMALIZED');
    expect(toNormalizedFileName('.hidden_file')).toBe('.hidden_file_NORMALIZED');
    expect(toNormalizedFileName('_NORMALIZED')).toBe('_NORMALIZED_2');
    expect(toNormalizedFileName('_NORMALIZED_7')).toBe('_NORMALIZED_8');
  });
});
