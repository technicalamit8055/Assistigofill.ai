import { notFound as nextNotFound } from 'next/navigation';
import Link from 'next/link';
import { Badge, TBody, TD, TH, THead, TR, Table, Card } from '@assistigo/ui';
import { CUSTOMER_FIELD_SECTIONS, fieldsInSection, formatIndianDate, isSensitiveField } from '@assistigo/core';
import { requirePagePermission } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n/server';
import { localised } from '@/lib/i18n';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { customerValuesFromRow } from '@/lib/customers/values';
import type { AuditLogRow, CustomerRow } from '@/lib/supabase/database.types';
import { CustomerProfileSections, type ProfileSection } from './profile-sections';
import { CustomerDocuments } from './customer-documents';
import { AddProfileInfo } from './add-profile-info';
import { DeleteCustomerButton } from './delete-customer-button';

export const metadata = { title: 'Customer profile' };

export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requirePagePermission('customer.view');
  const { t, locale } = await getTranslations();
  const supabase = await createSupabaseServerClient();

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('organization_id', session.organization.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!customer) nextNotFound();

  const row = customer as CustomerRow;
  const values = customerValuesFromRow(row);

  const [{ data: fieldValueRows }, { data: auditRows }] = await Promise.all([
    supabase
      .from('customer_field_values')
      .select('field_key, value_encrypted')
      .eq('organization_id', session.organization.id)
      .eq('customer_id', id),
    session.permissions.has('audit.view')
      ? supabase
          .from('audit_logs')
          .select('*')
          .eq('organization_id', session.organization.id)
          .eq('entity_type', 'customer')
          .eq('entity_id', id)
          .order('created_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
  ]);

  const encryptedFieldsPresent = new Set(
    (fieldValueRows ?? [])
      .filter((rowValue) => rowValue.value_encrypted)
      .map((rowValue) => rowValue.field_key as string),
  );

  const canReveal = session.permissions.has('customer.reveal_sensitive');
  const canUpdate = session.permissions.has('customer.update');
  const canDelete = session.permissions.has('customer.delete');
  const canUploadDocument = session.permissions.has('document.upload');
  const auditLogs = (auditRows ?? []) as AuditLogRow[];

  // The full Aadhaar number is deliberately left out of the editable field set: storing it in
  // full requires legal review and an org-level opt-in the app has no UI for yet (docs/
  // DEVELOPMENT_RULES.md §1 rule 5), so this page only ever exposes `customer.aadhaar_last4`.
  const sectionsData: ProfileSection[] = CUSTOMER_FIELD_SECTIONS.map((section) => ({
    section,
    title: t(`customers.sections.${section}`),
    fields: fieldsInSection(section)
      .filter((field) => field.storage.kind !== 'derived' && field.key !== 'customer.aadhaar')
      .map((field) => ({
        key: field.key,
        label: localised(field.label, locale),
        dataType: field.dataType,
        value: values[field.key] ?? null,
        sensitive: isSensitiveField(field.key),
        encrypted: field.storage.kind === 'encrypted',
        hasEncryptedValue: encryptedFieldsPresent.has(field.key),
        maxLength: field.maxLength ?? null,
        options: field.options
          ? field.options.map((option) => ({
              value: option.value,
              label: localised(option.label, locale),
            }))
          : null,
      })),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{row.full_name}</h1>
          <p className="mt-1 font-mono text-xs text-slate-500">{row.customer_code}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone="info">{row.verification_status}</Badge>
          {canDelete ? <DeleteCustomerButton customerId={row.id} /> : null}
        </div>
      </div>

      <CustomerProfileSections
        customerId={row.id}
        sections={sectionsData}
        canUpdate={canUpdate}
        canReveal={canReveal}
      />

      {row.notes ? (
        <Card title={t('customers.notes')}>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{row.notes}</p>
        </Card>
      ) : null}

      {canUpdate || canUploadDocument ? (
        <AddProfileInfo customerId={row.id} canPaste={canUpdate} canUpload={canUploadDocument} />
      ) : null}

      {session.permissions.has('document.view') ? (
        <CustomerDocuments customerId={row.id} organizationId={session.organization.id} />
      ) : null}

      {session.permissions.has('audit.view') ? (
        <Card title={t('customers.auditTrail')}>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500">{t('customers.auditEmpty')}</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>{t('customers.auditAction')}</TH>
                  <TH>{t('customers.created')}</TH>
                </TR>
              </THead>
              <TBody>
                {auditLogs.map((entry) => (
                  <TR key={entry.id}>
                    <TD>{t(`audit.actions.${entry.action}`)}</TD>
                    <TD className="text-slate-500">
                      {formatIndianDate(entry.created_at.slice(0, 10)) ?? '—'}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      ) : null}

      {!canUpdate ? null : (
        <p className="text-xs text-slate-400">
          <Link href="/customers" className="hover:underline">
            {t('common.back')}
          </Link>
        </p>
      )}
    </div>
  );
}
