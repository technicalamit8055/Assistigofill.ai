'use client';

import { useActionState } from 'react';
import { Alert, Button, Field, Select, TextField } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';
import { INDIAN_STATES } from '@/lib/constants/states';
import { createOrganizationAction, type OnboardingState } from './actions';

const BUSINESS_TYPES = [
  'cyber_cafe',
  'csc_vle',
  'csp',
  'digital_service_centre',
  'recruitment_centre',
  'other',
] as const;

const MONTHLY_FORM_BANDS = ['1-50', '51-200', '201-500', '501-1000', '1000+'] as const;

export function OnboardingForm() {
  const t = useTranslations();
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    createOrganizationAction,
    {},
  );

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">{t('onboarding.title')}</h1>
      <p className="mt-1 text-sm text-slate-500">{t('onboarding.subtitle')}</p>

      <form action={formAction} className="mt-6 space-y-4">
        {state.error ? <Alert tone="danger">{t(state.error)}</Alert> : null}

        <TextField
          label={t('onboarding.businessName')}
          name="name"
          required
          autoFocus
          maxLength={160}
        />

        <Field label={t('onboarding.businessType')} htmlFor="businessType" required>
          <Select id="businessType" name="businessType" defaultValue="cyber_cafe" required>
            {BUSINESS_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`onboarding.businessTypes.${type}`)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t('onboarding.city')} name="city" maxLength={120} />
          <TextField label={t('onboarding.district')} name="district" maxLength={120} />
        </div>

        <Field label={t('onboarding.state')} htmlFor="state">
          <Select id="state" name="state" defaultValue="">
            <option value="">{t('common.none')}</option>
            {INDIAN_STATES.map((stateName) => (
              <option key={stateName} value={stateName}>
                {stateName}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('onboarding.preferredLanguage')} htmlFor="locale" required>
          <Select id="locale" name="locale" defaultValue="en">
            <option value="en">English</option>
            <option value="hi">हिंदी</option>
          </Select>
        </Field>

        <Field label={t('onboarding.monthlyForms')} htmlFor="monthlyForms">
          <Select id="monthlyForms" name="monthlyForms" defaultValue="">
            <option value="">{t('common.none')}</option>
            {MONTHLY_FORM_BANDS.map((band) => (
              <option key={band} value={band}>
                {band}
              </option>
            ))}
          </Select>
        </Field>

        <Button type="submit" className="w-full" loading={pending}>
          {t('onboarding.create')}
        </Button>
      </form>
    </div>
  );
}
