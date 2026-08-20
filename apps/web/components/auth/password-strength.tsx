'use client';

import { cn } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';

/**
 * Client-only feedback on password quality. The three required checks mirror `passwordSchema` in
 * `app/(auth)/actions.ts` exactly, so the meter never says "good" for something the server will
 * reject. The value is never sent anywhere or logged — it lives in the field's own state.
 */
export type PasswordScore = { met: number; total: number; checks: PasswordCheck[] };

type PasswordCheck = { key: string; label: string; passed: boolean };

const BAR_TONES = [
  'bg-slate-200',
  'bg-red-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-emerald-500',
] as const;

export function scorePassword(value: string, t: (key: string) => string): PasswordScore {
  const checks: PasswordCheck[] = [
    { key: 'length', label: t('auth.strength.length'), passed: value.length >= 10 },
    { key: 'letter', label: t('auth.strength.letter'), passed: /[A-Za-z]/.test(value) },
    { key: 'number', label: t('auth.strength.number'), passed: /\d/.test(value) },
    // Not required by the server — shown as a bonus so a compliant password can still read
    // as "strong" rather than merely "acceptable".
    { key: 'variety', label: t('auth.strength.variety'), passed: /[^A-Za-z0-9]/.test(value) },
  ];

  return { met: checks.filter((check) => check.passed).length, total: checks.length, checks };
}

export function PasswordStrength({ value }: { value: string }) {
  const t = useTranslations();
  if (!value) return null;

  const { met, checks } = scorePassword(value, t);
  const requiredMet = checks.slice(0, 3).every((check) => check.passed);
  const labelKey = requiredMet
    ? met === 4
      ? 'auth.strength.strong'
      : 'auth.strength.good'
    : met >= 2
      ? 'auth.strength.weak'
      : 'auth.strength.tooShort';

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" role="presentation">
          {[1, 2, 3, 4].map((step) => (
            <span
              key={step}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors duration-300',
                step <= met ? BAR_TONES[met] : 'bg-slate-200',
              )}
            />
          ))}
        </div>
        <p
          aria-live="polite"
          className={cn(
            'w-24 shrink-0 text-right text-xs font-semibold',
            requiredMet ? 'text-emerald-700' : met >= 2 ? 'text-amber-700' : 'text-slate-500',
          )}
        >
          {t(labelKey)}
        </p>
      </div>

      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {checks.map((check) => (
          <li
            key={check.key}
            className={cn(
              'inline-flex items-center gap-1 text-xs',
              check.passed ? 'text-emerald-700' : 'text-slate-500',
            )}
          >
            <svg
              aria-hidden
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              {check.passed ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              ) : (
                <circle cx="12" cy="12" r="7" strokeWidth="1.6" />
              )}
            </svg>
            {check.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
