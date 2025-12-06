import { describe, expect, it } from 'bun:test';
import { enumerate } from './enumerate';

describe('enumerate', () => {
  it('yields [index, value] pairs for a non-empty array of primitives', () => {
    const arr = ['a', 'b', 'c'];
    const result = Array.from(enumerate(arr));
    expect(result).toEqual([
      [0, 'a'],
      [1, 'b'],
      [2, 'c'],
    ]);
  });

  it('yields [index, value] pairs for a non-empty array of objects', () => {
    const arr = [{ x: 1 }, { x: 2 }];
    const result = Array.from(enumerate(arr));
    expect(result).toEqual([
      [0, { x: 1 }],
      [1, { x: 2 }],
    ]);
  });

  it('yields nothing for an empty array', () => {
    const arr: number[] = [];
    const result = Array.from(enumerate(arr));
    expect(result).toEqual([]);
  });

  it('works with single-element arrays', () => {
    const arr = [42];
    const result = Array.from(enumerate(arr));
    expect(result).toEqual([[0, 42]]);
  });

  it('is iterable in for...of loops', () => {
    const arr = [10, 20, 30];
    const seen: Array<[number, number]> = [];
    for (const pair of enumerate(arr)) {
      seen.push(pair);
    }
    expect(seen).toEqual([
      [0, 10],
      [1, 20],
      [2, 30],
    ]);
  });

  it('yields correct indices even with undefined/null in array', () => {
    const arr = ['x', undefined, null, 'y'];
    const result = Array.from(enumerate(arr));
    expect(result).toEqual([
      [0, 'x'],
      [1, undefined],
      [2, null],
      [3, 'y'],
    ]);
  });
});
