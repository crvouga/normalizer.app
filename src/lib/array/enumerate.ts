/**
 * Yields index-value pairs from an array, similar to Python's enumerate.
 *
 * @template T The type of elements in the array.
 * @param {T[]} array - The array to enumerate.
 * @yields {[number, T]} The index and the value at that index.
 *
 * @example
 * const arr = ['a', 'b', 'c'];
 * for (const [i, value] of enumerate(arr)) {
 *   console.log(i, value);
 * }
 * // Output:
 * // 0 'a'
 * // 1 'b'
 * // 2 'c'
 */
export function* enumerate<T>(array: T[]): Generator<[number, T]> {
  for (let i = 0; i < array.length; i++) {
    yield [i, array[i]!];
  }
}
