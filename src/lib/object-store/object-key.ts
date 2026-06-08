export const OBJECT_KEY_PREFIX = 'normalizer-app' as const;

export type PrefixedObjectKey = string & { readonly __brand: 'PrefixedObjectKey' };

const PREFIX_WITH_SLASH = `${OBJECT_KEY_PREFIX}/`;

function validateSegment(segment: string): void {
  if (!segment || segment === '.' || segment === '..') {
    throw new Error(`Invalid object key segment: ${segment}`);
  }
  if (segment.includes('/') || segment.includes('\\')) {
    throw new Error(`Object key segment must not contain path separators: ${segment}`);
  }
}

function toPrefixedKey(key: string): PrefixedObjectKey {
  if (!key.startsWith(PREFIX_WITH_SLASH)) {
    throw new Error(`Object key must start with "${PREFIX_WITH_SLASH}": ${key}`);
  }
  if (key.includes('..')) {
    throw new Error(`Object key must not contain path traversal: ${key}`);
  }
  return key as PrefixedObjectKey;
}

/**
 * Build a prefixed object key from path segments.
 * Idempotent when the first segment is already the app prefix.
 */
export function objectKey(...segments: string[]): PrefixedObjectKey {
  if (segments.length === 0) {
    throw new Error('Object key requires at least one segment');
  }

  if (segments[0] === OBJECT_KEY_PREFIX) {
    const rest = segments.slice(1);
    for (const segment of rest) {
      validateSegment(segment);
    }
    return toPrefixedKey([OBJECT_KEY_PREFIX, ...rest].join('/'));
  }

  for (const segment of segments) {
    validateSegment(segment);
  }

  return toPrefixedKey(`${PREFIX_WITH_SLASH}${segments.join('/')}`);
}

/**
 * Enforce the app key prefix at runtime. Prepends when missing; throws on escape.
 */
export function enforceKeyPrefix(
  key: string,
  prefix: string = OBJECT_KEY_PREFIX,
): PrefixedObjectKey {
  const prefixWithSlash = `${prefix}/`;

  if (key.startsWith('..') || key.startsWith('/') || key.startsWith('\\')) {
    throw new Error(`Object key must not start with a path separator or traversal: ${key}`);
  }
  if (key.includes('..')) {
    throw new Error(`Object key must not contain path traversal: ${key}`);
  }

  const normalized = key.startsWith(prefixWithSlash) ? key : `${prefixWithSlash}${key}`;
  return toPrefixedKey(normalized);
}
