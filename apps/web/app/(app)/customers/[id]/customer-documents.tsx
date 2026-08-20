import Link from 'next/link';
import { Badge, Card, Table, TBody, TD, TH, THead, TR } from '@assistigo/ui';
import { DOCUMENT_TYPE_LABELS, formatIndianDate, isDocumentType } from '@assistigo/core';
import { getTranslations } from '@/lib/i18n/server';
import { localised } from '@/lib/i18n';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatBytes } from '@/lib/documents/format';
import type { DocumentRow } from '@/lib/supabase/database.types';

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  uploaded: 'neutral',
  processing: 'info',
  extracted: 'info',
  review_required: 'warning',
  verified: 'success',
  failed: 'danger',
};

/**
 * The documents attached to one customer (§7.3.4).
 *
 * Metadata only — opening a document goes through the signed-URL route, which is audited
 * (docs/SECURITY.md §4).
 */
export async function CustomerDocuments({
  customerId,
  organizationId,
}: {
  customerId: string;
  organizationId: string;
}) {
  const { t, locale } = await getTranslations();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('documents')
    .select('id, original_filename, document_type, status, size_bytes, created_at')
    .eq('organization_id', organizationId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(20);

  const documents = (data ?? []) as Partial<DocumentRow>[];

  return (
    <Card title={t('documents.title')}>
      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">{t('documents.emptyDescription')}</p>
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
  );
}
