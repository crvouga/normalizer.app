import { describe, expect, it } from 'bun:test';
import { hexToRgb } from './hex-to-rgb.ts';

describe('hexToRgb', () => {
  it('converts 6-digit hex with # to RGB', () => {
    expect(hexToRgb('#ff00aa')).toEqual([255, 0, 170]);
    expect(hexToRgb('#000000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#ffffff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#123456')).toEqual([18, 52, 86]);
  });

  it('converts 6-digit hex without # to RGB', () => {
    expect(hexToRgb('ff00aa')).toEqual([255, 0, 170]);
    expect(hexToRgb('abcdef')).toEqual([171, 205, 239]);
    expect(hexToRgb('654321')).toEqual([101, 67, 33]);
  });

  it('converts 3-digit hex with # to RGB', () => {
    expect(hexToRgb('#f0a')).toEqual([255, 0, 170]);
    expect(hexToRgb('#000')).toEqual([0, 0, 0]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
    expect(hexToRgb('#1a2')).toEqual([17, 170, 34]);
  });

  it('converts 3-digit hex without # to RGB', () => {
    expect(hexToRgb('f0a')).toEqual([255, 0, 170]);
    expect(hexToRgb('abc')).toEqual([170, 187, 204]);
    expect(hexToRgb('123')).toEqual([17, 34, 51]);
  });

  it('handles mixed case hex input', () => {
    expect(hexToRgb('#F0a')).toEqual([255, 0, 170]);
    expect(hexToRgb('AbCdEf')).toEqual([171, 205, 239]);
  });

  it('returns 0s for invalid hex', () => {
    // parseInt fails and returns NaN, the shifts turn NaN into 0
    expect(hexToRgb('zzz')).toEqual([0, 0, 0]);
    expect(hexToRgb('#xyz')).toEqual([0, 0, 0]);
    expect(hexToRgb('')).toEqual([0, 0, 0]);
  });

  it('ignores excess # chars', () => {
    expect(hexToRgb('##ff00aa')).toEqual([255, 0, 170]);
  });
});
