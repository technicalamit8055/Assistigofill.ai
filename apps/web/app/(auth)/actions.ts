'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/api/logger';
import { publicEnv } from '@/lib/env';

export type AuthFormState = { error?: string; notice?: string };

/**
 * Passwords: length is the property that actually resists guessing, so the rule is a longer
 * minimum plus a token check for mixed content, rather than a thicket of character classes
 * that pushes people towards Password1! (spec §19.4).
 */
const passwordSchema = z
  .string()
  .min(10, 'auth.passwordHint')
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), 'auth.passwordHint');

const signInSchema = z.object({
  email: z.string().trim().email('validation.email_invalid'),
  password: z.string().min(1, 'auth.invalidCredentials'),
  next: z.string().optional(),
});

const signUpSchema = z
  .object({
    email: z.string().trim().email('validation.email_invalid'),
    password: passwordSchema,
    confirmPassword: z.string(),
    consent: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'auth.passwordMismatch',
    path: ['confirmPassword'],
  })
  .refine((data) => data.consent === 'on', {
    message: 'auth.consentRequired',
    path: ['consent'],
  });

/** Only same-origin relative paths may be used as a post-sign-in destination. */
function safeNext(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/dashboard';
  return value;
}

export async function signInAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.validation_failed' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Deliberately identical for "no such user" and "wrong password" so the form cannot be
    // used to enumerate which emails have accounts.
    logger.warn('auth.login_failed', { reason: error.message });
    return { error: 'auth.invalidCredentials' };
  }

  redirect(safeNext(parsed.data.next));
}

export async function signUpAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.validation_failed' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/auth/callback` },
  });

  if (error) {
    logger.warn('auth.signup_failed', { reason: error.message });
    return { error: 'errors.internal' };
  }

  // With email confirmation on there is no session yet; tell them to check their inbox.
  if (!data.session) return { notice: 'auth.checkEmail' };

  redirect('/onboarding');
}

export async function forgotPasswordAction(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = z.string().trim().email().safeParse(formData.get('email'));

  if (email.success) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${publicEnv().NEXT_PUBLIC_APP_URL}/reset-password`,
    });
  }

  // Same answer whether or not the address exists, for the same enumeration reason as above.
  return { notice: 'auth.resetSent' };
}

export async function signOutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/sign-in');
}
