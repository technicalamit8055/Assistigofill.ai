'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';

export function DeleteCustomerButton({ customerId }: { customerId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/customers/${customerId}`, { method: 'DELETE' });
      if (!response.ok) {
        const json = (await response.json().catch(() => null)) as {
          error?: { messageKey: string };
        } | null;
        setError(json?.error?.messageKey ?? 'errors.internal');
        setPending(false);
        return;
      }
      router.push('/customers');
    } catch {
      setError('errors.internal');
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
        {t('common.delete')}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error ? <Alert tone="danger">{t(error)}</Alert> : null}
      <span className="text-sm text-slate-600">{t('customers.confirmDelete')}</span>
      <Button variant="danger" size="sm" loading={pending} onClick={() => void handleDelete()}>
        {t('common.delete')}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        {t('common.cancel')}
      </Button>
    </div>
  );
}
