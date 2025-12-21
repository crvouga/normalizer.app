/**
 * Tabular Data Format Registry
 *
 * Single source of truth for all tabular data formats, their metadata,
 * content types, extensions, and related utilities.
 */

/**
 * Supported tabular data formats
 */
export const TABULAR_FORMATS = {
  CSV: 'csv',
  EXCEL: 'excel',
  PARQUET: 'parquet',
  JSON: 'json',
} as const;

/**
 * Type representing a valid tabular format
 */
export type TabularFormat = (typeof TABULAR_FORMATS)[keyof typeof TABULAR_FORMATS];

/**
 * Format metadata including content type, extension, and display information
 */
export interface FormatMetadata {
  /** Canonical format name */
  name: TabularFormat;
  /** MIME content type */
  contentType: string;
  /** File extension (without leading dot) */
  extension: string;
  /** Display name for UI */
  displayName: string;
  /** Alternative names/aliases for backward compatibility */
  aliases?: readonly string[];
}

/**
 * Format registry mapping format names to their metadata
 */
const FORMAT_REGISTRY: Record<TabularFormat, FormatMetadata> = {
  csv: {
    name: 'csv',
    contentType: 'text/csv',
    extension: 'csv',
    displayName: 'CSV',
  },
  excel: {
    name: 'excel',
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extension: 'xlsx',
    displayName: 'Excel',
    aliases: ['xlsx'],
  },
  parquet: {
    name: 'parquet',
    contentType: 'application/parquet',
    extension: 'parquet',
    displayName: 'Parquet',
  },
  json: {
    name: 'json',
    contentType: 'application/json',
    extension: 'json',
    displayName: 'JSON',
  },
};

/**
 * Reverse lookup map from aliases to canonical format names
 */
const ALIAS_MAP: Record<string, TabularFormat> = {};
for (const [format, metadata] of Object.entries(FORMAT_REGISTRY)) {
  ALIAS_MAP[format] = format as TabularFormat;
  if (metadata.aliases) {
    for (const alias of metadata.aliases) {
      ALIAS_MAP[alias.toLowerCase()] = format as TabularFormat;
    }
  }
}

/**
 * Get metadata for a format by name (supports aliases)
 *
 * @param format Format name or alias
 * @returns Format metadata or undefined if format is not recognized
 */
export function getFormatMetadata(
  format: TabularFormat | (string & {}),
): FormatMetadata | undefined {
  const normalized = normalizeFormat(format);
  return normalized ? FORMAT_REGISTRY[normalized] : undefined;
}

/**
 * Normalize a format string to its canonical format name
 * Supports aliases (e.g., 'xlsx' -> 'excel')
 *
 * @param format Format name or alias
 * @returns Canonical format name or undefined if format is not recognized
 */
export function normalizeFormat(format: TabularFormat | (string & {})): TabularFormat | undefined {
  const normalized = format.toLowerCase();
  return ALIAS_MAP[normalized] as TabularFormat | undefined;
}

/**
 * Get content type (MIME type) for a format
 *
 * @param format Format name or alias
 * @returns Content type string, or 'application/octet-stream' if format is not recognized
 */
export function getContentType(format: TabularFormat | (string & {})): string {
  const metadata = getFormatMetadata(format);
  return metadata?.contentType ?? 'application/octet-stream';
}

/**
 * Get file extension for a format
 *
 * @param format Format name or alias
 * @returns File extension (without leading dot), or empty string if format is not recognized
 */
export function getExtension(format: TabularFormat | (string & {})): string {
  const metadata = getFormatMetadata(format);
  return metadata?.extension ?? '';
}

/**
 * Get display name for a format
 *
 * @param format Format name or alias
 * @returns Display name, or the original format string if not recognized
 */
export function getDisplayName(format: TabularFormat | (string & {})): string {
  const metadata = getFormatMetadata(format);
  return metadata?.displayName ?? format;
}

/**
 * Get the canonical format name for a given format string or alias.
 *
 * @param format Format name or alias
 * @returns Canonical format name, or undefined if not recognized
 */
export function getName(format: TabularFormat | (string & {})): string {
  const metadata = getFormatMetadata(format);
  return metadata?.name ?? format;
}

/**
 * Check if a format string is a valid tabular format (supports aliases)
 *
 * @param format Format name or alias to check
 * @returns true if format is recognized, false otherwise
 */
export function isValidFormat(format: TabularFormat | (string & {})): boolean {
  return normalizeFormat(format) !== undefined;
}

/**
 * Get all supported format names (canonical names only)
 *
 * @returns Array of canonical format names
 */
export function getAllFormats(): readonly TabularFormat[] {
  return Object.keys(FORMAT_REGISTRY) as TabularFormat[];
}

/**
 * Get the format from a key
 * @param key - The key to get the format from
 * @returns The format
 */
export function getFormatFromKey(key: string): TabularFormat {
  const extension = getExtension(key.split('.').pop() ?? '');
  return normalizeFormat(extension) ?? 'csv';
}
