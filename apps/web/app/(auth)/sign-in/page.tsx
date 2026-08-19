'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { Alert, Button, TextField } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';
import { signInAction, type AuthFormState } from '../actions';

export default function SignInPage() {
  const t = useTranslations();
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signInAction, {});

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">{t('auth.signInTitle')}</h1>

      <form action={formAction} className="mt-6 space-y-4">
        <input type="hidden" name="next" value={params.get('next') ?? '/dashboard'} />

        {state.error ? <Alert tone="danger">{t(state.error)}</Alert> : null}

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
          autoComplete="current-password"
          required
        />

        <Button type="submit" className="w-full" loading={pending}>
          {t('auth.signIn')}
        </Button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <Link href="/forgot-password" className="text-brand-700 hover:underline">
          {t('auth.forgotPassword')}
        </Link>
        <span className="text-slate-500">
          {t('auth.noAccount')}{' '}
          <Link href="/sign-up" className="text-brand-700 hover:underline">
            {t('auth.signUp')}
          </Link>
        </span>
      </div>
    </div>
  );
}
