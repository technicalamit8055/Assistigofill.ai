'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Alert, Button, TextField } from '@assistigo/ui';
import { AuthCard } from '@/components/auth/auth-card';
import { useTranslations } from '@/lib/i18n/client';
import { forgotPasswordAction, type AuthFormState } from '../actions';

export default function ForgotPasswordPage() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    forgotPasswordAction,
    {},
  );

  return (
    <AuthCard
      title={t('auth.resetPassword')}
      subtitle={t('auth.resetSubtitle')}
      footer={
        <Link
          href="/sign-in"
          className="inline-flex items-center gap-1.5 font-semibold text-[#0066FF] hover:underline"
        >
          <svg
            aria-hidden
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12l7.5-7.5M3 12h18" />
          </svg>
          {t('auth.signIn')}
        </Link>
      }
    >
      <form action={formAction} className="space-y-5">
        {state.notice ? <Alert tone="success">{t(state.notice)}</Alert> : null}

        <TextField
          label={t('auth.email')}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          autoFocus
          className="[&_input]:rounded-xl [&_input]:py-2.5 [&_input]:focus:ring-[#0066FF]"
        />

        <Button
          type="submit"
          size="lg"
          loading={pending}
          className="w-full rounded-xl bg-gradient-to-r from-[#0066FF] via-blue-600 to-cyan-500 font-bold shadow-lg shadow-blue-500/25 transition-all duration-300 hover:from-blue-700 hover:via-blue-700 hover:to-cyan-600 hover:shadow-blue-500/40 disabled:bg-none disabled:bg-blue-300"
        >
          {t('auth.resetPassword')}
        </Button>
      </form>
    </AuthCard>
  );
}
