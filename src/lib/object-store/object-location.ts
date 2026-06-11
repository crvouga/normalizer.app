import type { PrefixedObjectKey } from './object-key';

export type ObjectLocation = {
  key: PrefixedObjectKey;
  bucket: string;
};

const SEPARATOR = ':';

const encode = (location: ObjectLocation): string => {
  return `${location.bucket}${SEPARATOR}${location.key}`;
};

const decode = (encoded: string): ObjectLocation | null => {
  const [bucket, key] = encoded.split(SEPARATOR);
  if (!bucket || !key) {
    return null;
  }
  return { bucket, key: key as PrefixedObjectKey };
};

export const ObjectLocation = {
  encode,
  decode,
};
