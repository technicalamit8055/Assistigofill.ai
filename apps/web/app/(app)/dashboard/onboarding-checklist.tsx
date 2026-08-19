'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge, Card } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';

/**
 * First-run checklist (spec §7.2.4, §9.1).
 *
 * Extension detection: the content script sets `data-assistigo-extension` on <html> when it
 * loads on a dashboard page. Nothing is inferred from the absence of the marker beyond
 * "not connected" — we never probe the browser for installed extensions.
 */
function useExtensionInstalled(): boolean {
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const check = () =>
      setInstalled(document.documentElement.hasAttribute('data-assistigo-extension'));

    check();
    // The service worker may inject the marker a moment after hydration.
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-assistigo-extension'],
    });
    return () => observer.disconnect();
  }, []);

  return installed;
}

function ChecklistRow({ done, label, href }: { done: boolean; label: string; href: string }) {
  const t = useTranslations();
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <span className={done ? 'text-sm text-slate-500 line-through' : 'text-sm text-slate-800'}>
        {label}
      </span>
      {done ? (
        <Badge tone="success">{t('onboarding.checklist.done')}</Badge>
      ) : (
        <Link href={href} className="text-sm text-brand-700 hover:underline">
          {t('common.next')}
        </Link>
      )}
    </li>
  );
}

export function OnboardingChecklist({
  hasCustomers,
  hasDocuments,
}: {
  hasCustomers: boolean;
  hasDocuments: boolean;
}) {
  const t = useTranslations();
  const extensionInstalled = useExtensionInstalled();

  const allDone = hasCustomers && hasDocuments && extensionInstalled;
  if (allDone) return null;

  return (
    <Card title={t('onboarding.checklist.title')}>
      <ul className="divide-y divide-slate-100">
        <ChecklistRow
          done={hasCustomers}
          label={t('onboarding.checklist.addCustomer')}
          href="/customers/new"
        />
        <ChecklistRow
          done={hasDocuments}
          label={t('onboarding.checklist.uploadDocument')}
          href="/documents"
        />
        <ChecklistRow
          done={extensionInstalled}
          label={t('onboarding.checklist.installExtension')}
          href="/settings/extension"
        />
        <ChecklistRow
          done={false}
          label={t('onboarding.checklist.tryDemoForm')}
          href="/demo-forms"
        />
      </ul>
    </Card>
  );
}
