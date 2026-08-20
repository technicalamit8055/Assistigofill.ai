'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { Alert, Button, TextField } from '@assistigo/ui';
import { AuthCard } from '@/components/auth/auth-card';
import { PasswordField } from '@/components/auth/password-field';
import { PasswordStrength } from '@/components/auth/password-strength';
import { useTranslations } from '@/lib/i18n/client';
import { signUpAction, type AuthFormState } from '../actions';

export default function SignUpPage() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUpAction, {});
  // Held only to drive the strength meter; it is never submitted separately or logged.
  const [password, setPassword] = useState('');

  return (
    <AuthCard
      title={t('auth.signUpTitle')}
      subtitle={t('auth.signUpSubtitle')}
      footer={
        <>
          {t('auth.haveAccount')}{' '}
          <Link href="/sign-in" className="font-semibold text-[#0066FF] hover:underline">
            {t('auth.signIn')}
          </Link>
        </>
      }
    >
      <form action={formAction} className="space-y-5">
        {state.error ? <Alert tone="danger">{t(state.error)}</Alert> : null}
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

        <div>
          <PasswordField
            label={t('auth.password')}
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordStrength value={password} />
        </div>

        <PasswordField
          label={t('auth.confirmPassword')}
          name="confirmPassword"
          autoComplete="new-password"
          required
        />

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-sm text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50/40">
          <input
            type="checkbox"
            name="consent"
            required
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-[#0066FF] focus:ring-[#0066FF]"
          />
          <span className="leading-relaxed">
            {t('auth.consentPrefix')}{' '}
            <Link href="/legal/terms" className="font-semibold text-[#0066FF] hover:underline">
              {t('auth.consentTerms')}
            </Link>{' '}
            {t('auth.consentAnd')}{' '}
            <Link href="/legal/privacy" className="font-semibold text-[#0066FF] hover:underline">
              {t('auth.consentPrivacy')}
            </Link>
            {t('auth.consentSuffix')}
          </span>
        </label>

        <Button
          type="submit"
          size="lg"
          loading={pending}
          className="w-full rounded-xl bg-gradient-to-r from-[#0066FF] via-blue-600 to-cyan-500 font-bold shadow-lg shadow-blue-500/25 transition-all duration-300 hover:from-blue-700 hover:via-blue-700 hover:to-cyan-600 hover:shadow-blue-500/40 disabled:bg-none disabled:bg-blue-300"
        >
          {t('auth.signUp')}
        </Button>
      </form>
    </AuthCard>
  );
}
