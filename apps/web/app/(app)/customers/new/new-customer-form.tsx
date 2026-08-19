'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Alert, Badge, Button, Card, Select, TextField } from '@assistigo/ui';
import { DUPLICATE_REASON_LABELS, type DuplicateMatch } from '@assistigo/core';
import { useI18n, useTranslations } from '@/lib/i18n/client';

type CreateResponse =
  | { created: true; customer: { id: string; customer_code: string; full_name: string } }
  | { created: false; duplicates: DuplicateMatch[] };

export function NewCustomerForm() {
  const t = useTranslations();
  const { locale } = useI18n();
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [pendingFormData, setPendingFormData] = useState<Record<string, string> | null>(null);

  async function submit(payload: Record<string, string>, force: boolean) {
    setPending(true);
    setError(null);

    const body: Record<string, unknown> = { fullName: payload.fullName };
    if (payload.mobile) body.mobile = payload.mobile;
    if (payload.dateOfBirth) body.dateOfBirth = payload.dateOfBirth;
    if (payload.gender) body.gender = payload.gender;
    if (payload.fatherName) body.fatherName = payload.fatherName;
    if (payload.district) body.address = { current: { district: payload.district } };

    try {
      const response = await fetch(`/api/customers${force ? '?force=1' : ''}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const json = (await response.json()) as
        { data: CreateResponse } | { error: { messageKey: string } };

      if (!response.ok || 'error' in json) {
        setError('error' in json ? json.error.messageKey : 'errors.internal');
        setPending(false);
        return;
      }

      if (!json.data.created) {
        setDuplicates(json.data.duplicates);
        setPendingFormData(payload);
        setPending(false);
        return;
      }

      router.push(`/customers/${json.data.customer.id}`);
    } catch {
      setError('errors.internal');
      setPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(
      Array.from(form.entries()).map(([key, value]) => [key, String(value)]),
    );
    setDuplicates(null);
    void submit(payload, false);
  }

  if (duplicates && pendingFormData) {
    return (
      <Card>
        <Alert tone="warning" title={t('customers.duplicateWarning')}>
          <p className="mb-3">{t('customers.duplicateHelp')}</p>
          <ul className="space-y-2">
            {duplicates.map((match) => (
              <li
                key={match.candidateId}
                className="flex items-center justify-between gap-3 rounded-md border border-amber-200 bg-white px-3 py-2"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {match.reasons
                      .map((reason) => DUPLICATE_REASON_LABELS[reason][locale])
                      .join(', ')}
                  </p>
                  <Badge tone={match.confidence === 'high' ? 'danger' : 'warning'} className="mt-1">
                    {Math.round(match.score * 100)}%
                  </Badge>
                </div>
                <Link
                  href={`/customers/${match.candidateId}`}
                  className="text-sm font-medium text-brand-700 hover:underline"
                >
                  {t('customers.openExisting')}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button
              variant="secondary"
              loading={pending}
              onClick={() => submit(pendingFormData, true)}
            >
              {t('customers.createAnyway')}
            </Button>
            <Button variant="ghost" onClick={() => setDuplicates(null)}>
              {t('common.back')}
            </Button>
          </div>
        </Alert>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="space-y-4">
        <TextField label={t('customers.name')} name="fullName" required maxLength={160} autoFocus />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={t('customers.mobile')} name="mobile" type="tel" maxLength={16} />
          <TextField label={t('customers.district')} name="district" maxLength={120} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label={t('customers.fatherName')} name="fatherName" maxLength={160} />
          <TextField label={t('customers.dateOfBirth')} name="dateOfBirth" type="date" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="gender" className="text-sm font-medium text-slate-800">
            {t('customers.gender')}
          </label>
          <Select id="gender" name="gender" defaultValue="">
            <option value="">{t('common.optional')}</option>
            <option value="male">{t('customers.genderOptions.male')}</option>
            <option value="female">{t('customers.genderOptions.female')}</option>
            <option value="transgender">{t('customers.genderOptions.transgender')}</option>
            <option value="other">{t('customers.genderOptions.other')}</option>
          </Select>
        </div>

        {error ? <Alert tone="danger">{t(error)}</Alert> : null}

        <div className="flex gap-2">
          <Button type="submit" loading={pending}>
            {t('common.save')}
          </Button>
          <Link
            href="/customers"
            className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            {t('common.cancel')}
          </Link>
        </div>
      </form>
    </Card>
  );
}
