'use client';

import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n';
import { useI18n } from '@/lib/i18n/client';

/**
 * In-place language toggle. Operators switch mid-task — often because the customer in front of
 * them reads Hindi — so this never changes the URL or loses where they were.
 */
export function LocaleSwitcher() {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">{t('common.language')}</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="rounded-md border-0 bg-white py-1.5 pl-2 pr-7 text-sm text-slate-700 ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-brand-600"
      >
        {LOCALES.map((value) => (
          <option key={value} value={value}>
            {LOCALE_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  );
}
