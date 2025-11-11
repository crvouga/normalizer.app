/**
 * Converts a hex color string to an RGB array.
 *
 * @param {string} hex - The hex color string (e.g. "#ff00aa" or "ff00aa" or "f0a").
 * @returns {[number, number, number]} The RGB components as an array [r, g, b].
 */
export function hexToRgb(hex: string): [number, number, number] {
  hex = hex.replace(/#/g, '');
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((x) => x + x)
      .join('');
  }
  const num = parseInt(hex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
