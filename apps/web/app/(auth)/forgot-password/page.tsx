'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, Button, TextField } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';
import { forgotPasswordAction, type AuthFormState } from '../actions';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    forgotPasswordAction,
    {},
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">{t('auth.resetPassword')}</h1>

      <form action={formAction} className="mt-6 space-y-4">
        {state.notice ? <Alert tone="success">{t(state.notice)}</Alert> : null}

        <TextField
          label={t('auth.email')}
          name="email"
          type="email"
          autoComplete="email"
          required
          autoFocus
        />

        <Button type="submit" className="w-full" loading={pending}>
          {t('auth.resetPassword')}
        </Button>
      </form>

      <p className="mt-4 text-sm">
        <Link href="/sign-in" className="text-brand-700 hover:underline">
          {t('common.back')}
        </Link>
      </p>
    </div>
  );
}
