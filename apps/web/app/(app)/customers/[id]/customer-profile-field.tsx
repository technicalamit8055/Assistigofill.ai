'use client';

import { useState } from 'react';
import { Button } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';

export function CustomerProfileField({
  customerId,
  fieldKey,
  label,
  value,
  hasEncryptedValue,
  sensitive,
  canReveal,
}: {
  customerId: string;
  fieldKey: string;
  label: string;
  value: string | null;
  hasEncryptedValue: boolean;
  sensitive: boolean;
  canReveal: boolean;
}) {
  const t = useTranslations();
  const [revealed, setRevealed] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function reveal() {
    setPending(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/reveal`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ fieldKey }),
      });
      if (!response.ok) return;
      const json = (await response.json()) as { data: { value: string | null } };
      setRevealed(json.data.value ?? t('common.none'));
    } finally {
      setPending(false);
    }
  }

  // An encrypted field with no masked preview available still needs a way to reveal it.
  const displayValue = revealed ?? value ?? (hasEncryptedValue ? t('common.masked') : null);

  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
        {sensitive ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
            {t('common.masked')}
          </span>
        ) : null}
      </dt>
      <dd className="mt-0.5 flex items-center gap-2 text-sm text-slate-900">
        <span className="break-words">{displayValue ?? t('common.none')}</span>
        {sensitive && canReveal && revealed === null ? (
          <Button
            variant="link"
            size="sm"
            type="button"
            loading={pending}
            onClick={() => void reveal()}
          >
            {t('common.reveal')}
          </Button>
        ) : null}
      </dd>
    </div>
  );
}
