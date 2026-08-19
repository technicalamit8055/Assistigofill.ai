/**
 * Hindi / English localisation.
 * Master spec §20.
 *
 * Deliberately small and dependency-free: the app has two locales and no route-level locale
 * segment (operators switch language in place, mid-task), so a full i18n framework would add
 * more configuration than value.
 */

import en from '../../messages/en.json';
import hi from '../../messages/hi.json';

export const LOCALES = ['en', 'hi'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'assistigo_locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिंदी',
};

type Messages = typeof en;

const DICTIONARIES: Record<Locale, Messages> = {
  en,
  hi: hi as Messages,
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Messages {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

function lookup(dictionary: unknown, path: readonly string[]): unknown {
  return path.reduce<unknown>(
    (node, key) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined,
    dictionary,
  );
}

export type TranslateValues = Record<string, string | number>;

/**
 * Returns a `t(key, values?)` function.
 *
 * A missing Hindi string falls back to English rather than rendering a raw key — an operator
 * mid-application should never be shown `customers.duplicateWarning`.
 */
export function createTranslator(locale: Locale) {
  const dictionary = getDictionary(locale);
  const fallback = getDictionary(DEFAULT_LOCALE);

  return function t(key: string, values?: TranslateValues): string {
    const path = key.split('.');
    const resolved = lookup(dictionary, path) ?? lookup(fallback, path);

    if (typeof resolved !== 'string') {
      // Loud in development, harmless in production.
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[i18n] missing translation for "${key}" (${locale})`);
      }
      return key;
    }

    if (!values) return resolved;
    return resolved.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match,
    );
  };
}

export type Translator = ReturnType<typeof createTranslator>;

/** Pick the label from a `{ en, hi }` pair carried by domain constants in @assistigo/core. */
export function localised(labels: { en: string; hi: string }, locale: Locale): string {
  return labels[locale] ?? labels.en;
}
