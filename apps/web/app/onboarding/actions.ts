'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { LOCALE_COOKIE } from '@/lib/i18n';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/api/logger';

export type OnboardingState = { error?: string };

const schema = z.object({
  name: z.string().trim().min(2, 'validation.name_required').max(160),
  businessType: z.enum([
    'cyber_cafe',
    'csc_vle',
    'csp',
    'digital_service_centre',
    'recruitment_centre',
    'other',
  ]),
  city: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  locale: z.enum(['en', 'hi']).default('en'),
  monthlyForms: z.string().trim().max(40).optional(),
});

/**
 * Creates the organization through the `create_organization` RPC.
 *
 * The RPC — not a plain insert — because an organization, its owner membership and its free
 * subscription have to appear together or not at all. `organizations` has no INSERT policy for
 * exactly this reason (see supabase/migrations/0011_rpc.sql).
 */
export async function createOrganizationAction(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.validation_failed' };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc('create_organization', {
    p_name: parsed.data.name,
    p_business_type: parsed.data.businessType,
    p_city: parsed.data.city ?? null,
    p_district: parsed.data.district ?? null,
    p_state: parsed.data.state ?? null,
    p_locale: parsed.data.locale,
    p_monthly_forms: parsed.data.monthlyForms ?? null,
  });

  if (error || !data) {
    logger.error('organization.create_failed', { reason: error?.message });
    return { error: 'errors.internal' };
  }

  // Start the operator in the language they just chose.
  const store = await cookies();
  store.set(LOCALE_COOKIE, parsed.data.locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  redirect('/dashboard?welcome=1');
}
