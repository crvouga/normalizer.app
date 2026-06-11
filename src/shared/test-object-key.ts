import { enforceKeyPrefix, objectKey } from '../lib/object-store/object-key';

/** Build a prefixed object key for tests. */
export const testObjectKey = (...segments: string[]) => objectKey(...segments);

/** Coerce a relative path to a prefixed key in tests. */
export const asTestKey = (relativePath: string) => enforceKeyPrefix(relativePath);
