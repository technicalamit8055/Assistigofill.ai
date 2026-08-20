import Link from 'next/link';
import { Badge, Card, EmptyState, Table, TBody, TD, TH, THead, TR } from '@assistigo/ui';
import { DOCUMENT_TYPE_LABELS, formatIndianDate, isDocumentType } from '@assistigo/core';
import { requirePagePermission } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n/server';
import { localised } from '@/lib/i18n';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { DocumentRow } from '@/lib/supabase/database.types';
import { formatBytes } from '@/lib/documents/format';

export const metadata = { title: 'Documents' };

const BUTTON_LINK =
  'inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600';

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  uploaded: 'neutral',
  processing: 'info',
  extracted: 'info',
  review_required: 'warning',
  verified: 'success',
  failed: 'danger',
};

export default async function DocumentsPage() {
  const session = await requirePagePermission('document.view');
  const { t, locale } = await getTranslations();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('documents')
    .select(
      'id, customer_id, original_filename, mime_type, size_bytes, document_type, status, created_at',
    )
    .eq('organization_id', session.organization.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  const documents = (data ?? []) as Partial<DocumentRow>[];
  const canUpload = session.permissions.has('document.upload');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{t('documents.title')}</h1>
          <p className="mt-1 text-sm text-slate-500">{t('documents.subtitle')}</p>
        </div>
        {canUpload ? (
          <Link href="/documents/upload" className={BUTTON_LINK}>
            {t('documents.upload')}
          </Link>
        ) : null}
      </div>

      <Card>
        {documents.length === 0 ? (
          <EmptyState
            title={t('documents.emptyTitle')}
            description={t('documents.emptyDescription')}
            action={
              canUpload ? (
                <Link href="/documents/upload" className={BUTTON_LINK}>
                  {t('documents.upload')}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t('documents.file')}</TH>
                <TH>{t('documents.type')}</TH>
                <TH>{t('documents.size')}</TH>
                <TH>{t('settings.status')}</TH>
                <TH>{t('customers.created')}</TH>
              </TR>
            </THead>
            <TBody>
              {documents.map((document) => (
                <TR key={document.id}>
                  <TD>
                    <Link
                      href={`/documents/${document.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {document.original_filename}
                    </Link>
                  </TD>
                  <TD className="text-slate-600">
                    {isDocumentType(document.document_type)
                      ? localised(DOCUMENT_TYPE_LABELS[document.document_type], locale)
                      : '—'}
                  </TD>
                  <TD className="tabular-nums text-slate-500">
                    {formatBytes(document.size_bytes ?? 0)}
                  </TD>
                  <TD>
                    <Badge tone={STATUS_TONE[document.status ?? ''] ?? 'neutral'}>
                      {t(`documents.statuses.${document.status}`)}
                    </Badge>
                  </TD>
                  <TD className="text-slate-500">
                    {formatIndianDate(document.created_at?.slice(0, 10)) ?? '—'}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
