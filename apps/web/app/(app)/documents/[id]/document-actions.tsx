'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@assistigo/ui';
import { useTranslations } from '@/lib/i18n/client';

/**
 * View / re-process / delete for one document.
 *
 * "View" fetches a fresh signed URL every time rather than embedding one in the page: the URL
 * expires in five minutes and each issue is audited, so a link sitting in rendered HTML would
 * be both stale and unlogged (docs/SECURITY.md §4).
 */
export function DocumentActions({
  documentId,
  canDownload,
  canDelete,
  canProcess,
  status,
}: {
  documentId: string;
  canDownload: boolean;
  canDelete: boolean;
  canProcess: boolean;
  status: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [busy, setBusy] = useState<'view' | 'process' | 'delete' | null>(null);

  async function view() {
    setBusy('view');
    try {
      const response = await fetch(`/api/documents/${documentId}/signed-url`, { method: 'POST' });
      const json = (await response.json()) as { data?: { url: string } };
      if (json.data?.url) window.open(json.data.url, '_blank', 'noopener,noreferrer');
    } finally {
      setBusy(null);
    }
  }

  async function reprocess() {
    setBusy('process');
    try {
      await fetch(`/api/documents/${documentId}/process`, { method: 'POST' });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm(t('documents.deleteConfirm'))) return;
    setBusy('delete');
    try {
      const response = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' });
      if (response.ok) router.push('/documents');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {canDownload ? (
        <Button size="sm" variant="secondary" loading={busy === 'view'} onClick={view}>
          {t('documents.view')}
        </Button>
      ) : null}
      {canProcess && status !== 'processing' ? (
        <Button size="sm" variant="ghost" loading={busy === 'process'} onClick={reprocess}>
          {t('documents.reprocess')}
        </Button>
      ) : null}
      {canDelete ? (
        <Button size="sm" variant="ghost" loading={busy === 'delete'} onClick={remove}>
          {t('common.delete')}
        </Button>
      ) : null}
    </div>
  );
}
