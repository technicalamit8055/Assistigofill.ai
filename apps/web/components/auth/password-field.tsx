'use client';

import { useId, useState, type InputHTMLAttributes } from 'react';
import { cn } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  hint?: string;
  error?: string;
};

/**
 * Password input with a reveal toggle. Operators type these at a counter with a customer beside
 * them, so it starts masked every time and is never persisted as revealed.
 */
export function PasswordField({
  label,
  hint,
  error,
  required,
  className,
  ...inputProps
}: PasswordFieldProps) {
  const t = useTranslations();
  const id = useId();
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-slate-800">
        {label}
        {required ? (
          <span aria-hidden className="text-red-600">
            *
          </span>
        ) : null}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          className={cn(
            'block w-full rounded-xl border-0 bg-white py-2.5 pl-3 pr-11 text-slate-900 shadow-sm',
            'ring-1 ring-inset ring-slate-300 placeholder:text-slate-400',
            'transition focus:ring-2 focus:ring-inset focus:ring-[#0066FF]',
            'disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm',
            error && 'ring-red-400 focus:ring-red-500',
          )}
          {...inputProps}
        />

        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-slate-400 transition-colors hover:text-slate-700"
        >
          {visible ? (
            <svg
              aria-hidden
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.774 3.162 10.066 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243"
              />
            </svg>
          ) : (
            <svg
              aria-hidden
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          )}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}
