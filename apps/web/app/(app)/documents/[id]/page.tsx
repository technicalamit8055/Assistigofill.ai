import { notFound as nextNotFound } from 'next/navigation';
import Link from 'next/link';
import { z } from 'zod';
import { Alert, Badge, Card } from '@assistigo/ui';
import { extractedFieldSchema, extractionWarningSchema } from '@assistigo/ai';
import {
  DOCUMENT_TYPE_LABELS,
  formatIndianDate,
  getCustomerField,
  isDocumentType,
} from '@assistigo/core';
import { requirePagePermission } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n/server';
import { localised } from '@/lib/i18n';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { formatBytes, formatConfidence } from '@/lib/documents/format';
import type {
  CustomerRow,
  DocumentExtractionRow,
  DocumentRow,
} from '@/lib/supabase/database.types';
import { ExtractionReview, type ReviewField } from './extraction-review';
import { DocumentActions } from './document-actions';

export const metadata = { title: 'Document' };

const storedFieldsSchema = z.array(extractedFieldSchema).catch([]);
const storedWarningsSchema = z.array(extractionWarningSchema).catch([]);

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  uploaded: 'neutral',
  processing: 'info',
  extracted: 'info',
  review_required: 'warning',
  verified: 'success',
  failed: 'danger',
};

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePagePermission('document.view');
  const { t, locale } = await getTranslations();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .eq('organization_id', session.organization.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!data) nextNotFound();
  const document = data as DocumentRow;

  const [{ data: extractionData }, { data: customerData }] = await Promise.all([
    supabase
      .from('document_extractions')
      .select('*')
      .eq('organization_id', session.organization.id)
      .eq('document_id', id)
      .maybeSingle(),
    document.customer_id
      ? supabase
          .from('customers')
          .select('id, full_name, customer_code')
          .eq('id', document.customer_id)
          .eq('organization_id', session.organization.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const extraction = extractionData as DocumentExtractionRow | null;
  const customer = customerData as Pick<
    CustomerRow,
    'id' | 'full_name' | 'customer_code'
  > | null;

  const fields: ReviewField[] = storedFieldsSchema
    .parse(extraction?.extracted_fields ?? [])
    .map((field) => {
      const definition = getCustomerField(field.key);
      return {
        ...field,
        fieldLabel: definition?.label ?? null,
        sensitivity: definition?.sensitivity ?? 'normal',
      };
    });

  const warnings = storedWarningsSchema.parse(extraction?.warnings ?? []);
  const alreadyReviewed = extraction?.status === 'accepted' || extraction?.status === 'rejected';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-slate-900">
            {document.original_filename}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isDocumentType(document.document_type)
              ? localised(DOCUMENT_TYPE_LABELS[document.document_type], locale)
              : t('documents.statuses.unknown')}{' '}
            · {formatBytes(document.size_bytes)} ·{' '}
            {formatIndianDate(document.created_at.slice(0, 10)) ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={STATUS_TONE[document.status] ?? 'neutral'}>
            {t(`documents.statuses.${document.status}`)}
          </Badge>
          <DocumentActions
            documentId={document.id}
            canDownload={session.permissions.has('document.download')}
            canDelete={session.permissions.has('document.delete')}
            canProcess={session.permissions.has('document.upload')}
            status={document.status}
          />
        </div>
      </div>

      <Card title={t('documents.details')}>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('documents.customer')}
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {customer ? (
                <Link href={`/customers/${customer.id}`} className="text-brand-700 hover:underline">
                  {customer.full_name}
                </Link>
              ) : (
                t('documents.noCustomer')
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('documents.review.confidence')}
            </dt>
            <dd className="mt-1 text-sm text-slate-900">
              {formatConfidence(extraction?.confidence ?? null)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t('documents.provider')}
            </dt>
            <dd className="mt-1 text-sm text-slate-900">{extraction?.provider ?? '—'}</dd>
          </div>
        </dl>
      </Card>

      {warnings.length > 0 ? (
        <Alert tone="warning" title={t('documents.warnings.title')}>
          <ul className="list-inside list-disc space-y-1">
            {warnings.map((warning) => (
              <li key={`${warning.code}-${warning.fieldKey ?? ''}`}>{t(warning.messageKey)}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {document.status === 'processing' ? (
        <Alert tone="info" title={t('documents.processingTitle')}>
          {t('documents.processingHelp')}
        </Alert>
      ) : null}

      {document.status === 'failed' ? (
        <Alert tone="danger" title={t('documents.failedTitle')}>
          {t('documents.failedHelp')}
        </Alert>
      ) : null}

      {alreadyReviewed ? (
        <Alert tone="success" title={t('documents.review.doneTitle')}>
          {t('documents.review.doneHelp', {
            date: formatIndianDate(extraction?.reviewed_at?.slice(0, 10) ?? null) ?? '',
          })}
        </Alert>
      ) : extraction ? (
        <ExtractionReview
          documentId={document.id}
          fields={fields}
          hasCustomer={Boolean(document.customer_id)}
          canReview={session.permissions.has('extraction.review')}
        />
      ) : null}
    </div>
  );
}
