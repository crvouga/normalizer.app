import type en from './locales/en.json';

export type Locale = 'en';

export type TranslationKeys = typeof en;

// Helper type to get nested keys as dot notation
type RecursiveKeyOf<TObj extends object> = {
  [TKey in keyof TObj & string]: TObj[TKey] extends object
    ? `${TKey}` | `${TKey}.${RecursiveKeyOf<TObj[TKey]>}`
    : `${TKey}`;
}[keyof TObj & string];

export type TranslationKey = RecursiveKeyOf<TranslationKeys>;

// Type for interpolation values
export type InterpolationValues = Record<string, string | number>;
