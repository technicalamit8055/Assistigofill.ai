'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState } from 'react';
import { Alert, Button, TextField } from '@assistigo/ui';
import { AuthCard } from '@/components/auth/auth-card';
import { PasswordField } from '@/components/auth/password-field';
import { useTranslations } from '@/lib/i18n/client';
import { signInAction, type AuthFormState } from '../actions';

export default function SignInPage() {
  const t = useTranslations();
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signInAction, {});

  return (
    <AuthCard
      title={t('auth.signInTitle')}
      subtitle={t('auth.signInSubtitle')}
      footer={
        <>
          {t('auth.noAccount')}{' '}
          <Link href="/sign-up" className="font-semibold text-[#0066FF] hover:underline">
            {t('auth.signUp')}
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-5">
        <input type="hidden" name="next" value={params.get('next') ?? '/dashboard'} />

        {state.error ? <Alert tone="danger">{t(state.error)}</Alert> : null}

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

        <div className="space-y-2">
          <PasswordField
            label={t('auth.password')}
            name="password"
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-[#0066FF] hover:underline"
            >
              {t('auth.forgotPassword')}
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          loading={pending}
          className="w-full rounded-xl bg-gradient-to-r from-[#0066FF] via-blue-600 to-cyan-500 font-bold shadow-lg shadow-blue-500/25 transition-all duration-300 hover:from-blue-700 hover:via-blue-700 hover:to-cyan-600 hover:shadow-blue-500/40 disabled:bg-none disabled:bg-blue-300"
        >
          {t('auth.signIn')}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
          <svg
            aria-hidden
            className="h-3.5 w-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          {t('auth.secureNote')}
        </p>
      </form>
    </AuthCard>
  );
}
