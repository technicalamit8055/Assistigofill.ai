import 'server-only';

import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, createTranslator, isLocale, type Locale } from './index';

/**
 * Resolution order: explicit cookie → organization default (set at sign-in) → English.
 * The cookie wins so an operator can switch language for their own session without changing
 * what their colleagues see.
 */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getTranslations() {
  const locale = await getLocale();
  return { locale, t: createTranslator(locale) };
}
