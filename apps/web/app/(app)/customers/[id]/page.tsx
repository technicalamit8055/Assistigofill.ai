import { notFound as nextNotFound } from 'next/navigation';
import Link from 'next/link';
import { Badge, Card, TBody, TD, TH, THead, TR, Table } from '@assistigo/ui';
import {
  CUSTOMER_FIELD_SECTIONS,
  fieldsInSection,
  formatIndianDate,
  isSensitiveField,
  type CustomerFieldSection,
} from '@assistigo/core';
import { requirePagePermission } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n/server';
import { localised } from '@/lib/i18n';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { customerValuesFromRow } from '@/lib/customers/values';
import type { AuditLogRow, CustomerRow } from '@/lib/supabase/database.types';
import { CustomerProfileField } from './customer-profile-field';
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

      {CUSTOMER_FIELD_SECTIONS.map((section: CustomerFieldSection) => {
        const fields = fieldsInSection(section).filter(
          (field) => field.storage.kind !== 'derived' || values[field.key] !== undefined,
        );
        const hasAnyValue = fields.some(
          (field) => values[field.key] !== undefined || encryptedFieldsPresent.has(field.key),
        );
        if (!hasAnyValue) return null;

        return (
          <Card key={section} title={t(`customers.sections.${section}`)}>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((field) => {
                const hasEncryptedValue = encryptedFieldsPresent.has(field.key);
                const rawValue = values[field.key] ?? null;
                if (rawValue === null && !hasEncryptedValue) return null;

                return (
                  <CustomerProfileField
                    key={field.key}
                    customerId={row.id}
                    fieldKey={field.key}
                    label={localised(field.label, locale)}
                    value={rawValue}
                    hasEncryptedValue={hasEncryptedValue}
                    sensitive={isSensitiveField(field.key)}
                    canReveal={canReveal}
                  />
                );
              })}
            </dl>
          </Card>
        );
      })}

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
