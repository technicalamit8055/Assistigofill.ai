'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  createTranslator,
  type Locale,
  type TranslateValues,
} from './index';

type I18nContextValue = {
  locale: Locale;
  t: (key: string, values?: TranslateValues) => string;
  setLocale: (locale: Locale) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const setLocale = useCallback((next: Locale) => {
    // One year, lax: a language preference is not a security boundary, and it must survive
    // the operator closing the browser at the end of the day.
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    window.location.reload();
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({ locale, t: createTranslator(locale), setLocale }),
    [locale, setLocale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    // Rendering English rather than crashing: a missing provider should not take down a page
    // an operator is in the middle of using.
    return {
      locale: DEFAULT_LOCALE,
      t: createTranslator(DEFAULT_LOCALE),
      setLocale: () => undefined,
    };
  }
  return context;
}

export function useTranslations() {
  return useI18n().t;
}
