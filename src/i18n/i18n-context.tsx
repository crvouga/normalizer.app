import { createContext, type ReactNode } from 'react';
import type { Locale, TranslationKey, InterpolationValues, I18nText } from './types';
import { toI18nText } from './types';
import en from './locales/en.json';

const translations: Record<Locale, typeof en> = {
  en,
};

interface I18nContextValue {
  locale: Locale;
  t: (key: TranslationKey, values?: InterpolationValues) => I18nText;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  locale?: Locale;
}

export function I18nProvider({ children, locale = 'en' }: I18nProviderProps) {
  const t = (key: TranslationKey, values?: InterpolationValues): I18nText => {
    const keys = key.split('.');
    let translation: any = translations[locale];

    // Navigate through nested keys
    for (const k of keys) {
      if (translation && typeof translation === 'object' && k in translation) {
        translation = translation[k];
      } else {
        // Fallback to key if translation not found
        console.warn(`Translation missing for key: ${key}`);
        return toI18nText(key);
      }
    }

    // If translation is not a string, return the key
    if (typeof translation !== 'string') {
      console.warn(`Translation for key "${key}" is not a string`);
      return toI18nText(key);
    }

    // Handle interpolation
    if (values) {
      const interpolated = Object.entries(values).reduce((str, [placeholder, value]) => {
        return str.replace(new RegExp(`{{${placeholder}}}`, 'g'), String(value));
      }, translation);
      return toI18nText(interpolated);
    }

    return toI18nText(translation);
  };

  const setLocale = (newLocale: Locale) => {
    // For future implementation - could store in localStorage
    console.log('Setting locale to:', newLocale);
  };

  return <I18nContext.Provider value={{ locale, t, setLocale }}>{children}</I18nContext.Provider>;
}
