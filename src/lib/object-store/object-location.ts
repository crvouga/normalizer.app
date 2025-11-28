export type ObjectLocation = {
  key: string;
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
  return { bucket, key };
};

export const ObjectLocation = {
  encode,
  decode,
};
