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

/**
 * Opaque type for internationalized text.
 * This type is only returned from the t() function and ensures type safety
 * by preventing hardcoded strings from being passed where translations are expected.
 */
export type I18nText = string & { readonly __brand: 'I18nText' };

/**
 * Internal helper function to create I18nText from a string.
 * This should only be used by the t() function in i18n-context.tsx
 */
export function toI18nText(value: string): I18nText {
  return value as I18nText;
}
