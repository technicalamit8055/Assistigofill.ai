'use client';

import { useState } from 'react';
import { Card, cn } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';
import { PasteTextPanel } from './paste-text-panel';
import { UploadDocumentPanel } from './upload-document-panel';

type Mode = 'paste' | 'upload';

const TAB_BASE = 'border-b-2 pb-2 text-sm font-medium';
const TAB_ACTIVE = 'border-brand-600 text-brand-700';
const TAB_INACTIVE = 'border-transparent text-slate-500 hover:text-slate-700';

/**
 * One card for everything that starts a customer's profile from something other than typing into
 * the field forms (§9.3, §7.3.4): pasted text, or an uploaded document. Both are ways to reach
 * the same destination — proposed profile fields a human must accept before anything is saved —
 * so they live behind one set of tabs instead of two separate cards an operator has to discover.
 *
 * Paste review happens inline, right here. Document review does not: extraction runs as a
 * background job, so uploading here only queues it — the operator reviews it on the document's
 * own page once reading finishes, linked from the confirmation and from the Documents list below.
 */
export function AddProfileInfo({
  customerId,
  canPaste,
  canUpload,
}: {
  customerId: string;
  canPaste: boolean;
  canUpload: boolean;
}) {
  const t = useTranslations();
  const [mode, setMode] = useState<Mode>(canPaste ? 'paste' : 'upload');

  if (!canPaste && !canUpload) return null;

  const showTabs = canPaste && canUpload;

  return (
    <Card title={t('customers.paste.title')}>
      {showTabs ? (
        <div
          role="tablist"
          aria-label={t('customers.paste.title')}
          className="mb-4 flex gap-4 border-b border-slate-200"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'paste'}
            onClick={() => setMode('paste')}
            className={cn(TAB_BASE, mode === 'paste' ? TAB_ACTIVE : TAB_INACTIVE)}
          >
            {t('customers.paste.tabPaste')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'upload'}
            onClick={() => setMode('upload')}
            className={cn(TAB_BASE, mode === 'upload' ? TAB_ACTIVE : TAB_INACTIVE)}
          >
            {t('documents.upload')}
          </button>
        </div>
      ) : null}

      {mode === 'paste' && canPaste ? <PasteTextPanel customerId={customerId} /> : null}
      {mode === 'upload' && canUpload ? <UploadDocumentPanel customerId={customerId} /> : null}
    </Card>
  );
}
