/**
 * Given a filename, generate its normalized name by appending "_NORMALIZED" (before extension),
 * or incrementing the numeric suffix if it already ends in "_NORMALIZED" or "_NORMALIZED_N".
 *
 * Examples:
 * - "file.pdf"            => "file_NORMALIZED.pdf"
 * - "file_NORMALIZED.pdf" => "file_NORMALIZED_2.pdf"
 * - "file_NORMALIZED_2.pdf" => "file_NORMALIZED_3.pdf"
 */
export function toNormalizedFileName(baseName: string): string {
  const namePart = toNamePart(baseName);
  const extPart = toExtPart(baseName);

  // Match name ending with "_NORMALIZED" or "_NORMALIZED_<N>"
  const match = namePart.match(/^(.*)_NORMALIZED(?:_(\d+))?$/);

  if (!match) {
    // No "_NORMALIZED", just append
    return `${namePart}_NORMALIZED${extPart}`;
  }

  const [, prefix, num] = match;
  if (!num) {
    // "_NORMALIZED" only (no number), set to 2.
    return `${prefix}_NORMALIZED_2${extPart}`;
  }

  // "_NORMALIZED_N" exists, increment.
  const incremented = parseInt(num, 10) + 1;
  return `${prefix}_NORMALIZED_${incremented}${extPart}`;
}

// Helper to extract the name part (excluding extension)
function toNamePart(baseName: string): string {
  const lastDot = baseName.lastIndexOf('.');
  // Edge case: file starts with a dot (e.g., ".hidden_file")
  if (lastDot === -1 || lastDot === 0) return baseName;
  return baseName.slice(0, lastDot);
}

// Helper to extract the extension part (including dot)
function toExtPart(baseName: string): string {
  const lastDot = baseName.lastIndexOf('.');
  if (lastDot === -1 || lastDot === 0) return '';
  return baseName.slice(lastDot);
}
