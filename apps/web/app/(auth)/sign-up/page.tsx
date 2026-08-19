'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, Button, TextField } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';
import { signUpAction, type AuthFormState } from '../actions';

export default function SignUpPage() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUpAction, {});

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">{t('auth.signUpTitle')}</h1>

      <form action={formAction} className="mt-6 space-y-4">
        {state.error ? <Alert tone="danger">{t(state.error)}</Alert> : null}
        {state.notice ? <Alert tone="success">{t(state.notice)}</Alert> : null}

        <TextField
          label={t('auth.email')}
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
        />

        <TextField
          label={t('auth.password')}
          name="password"
          type="password"
          autoComplete="new-password"
          hint={t('auth.passwordHint')}
          required
        />

        <TextField
          label={t('auth.confirmPassword')}
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
          />
          <span>
            {t('auth.consent')}{' '}
            <Link href="/legal/terms" className="text-brand-700 hover:underline">
              Terms
            </Link>
            {' · '}
            <Link href="/legal/privacy" className="text-brand-700 hover:underline">
              Privacy
            </Link>
          </span>
        </label>

        <Button type="submit" className="w-full" loading={pending}>
          {t('auth.signUp')}
        </Button>
      </form>

      <p className="mt-4 text-sm text-slate-500">
        {t('auth.haveAccount')}{' '}
        <Link href="/sign-in" className="text-brand-700 hover:underline">
          {t('auth.signIn')}
        </Link>
      </p>
    </div>
  );
}
