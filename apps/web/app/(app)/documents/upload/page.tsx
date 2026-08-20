import { maskLast4 } from '@assistigo/core';
import { requirePagePermission } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CustomerRow } from '@/lib/supabase/database.types';
import { UploadForm } from './upload-form';

export const metadata = { title: 'Upload document' };

export default async function UploadDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const session = await requirePagePermission('document.upload');
  const { t } = await getTranslations();
  const supabase = await createSupabaseServerClient();
  const { customerId } = await searchParams;

  // The picker is a convenience for the common case, not the whole customer list. An operator
  // with thousands of customers uploads from the customer's own profile instead.
  const { data } = await supabase
    .from('customers')
    .select('id, full_name, customer_code, mobile')
    .eq('organization_id', session.organization.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(50);

  const customers = ((data ?? []) as Partial<CustomerRow>[]).map((customer) => {
    const last4 = maskLast4(customer.mobile ?? null);
    return {
      id: String(customer.id),
      label: last4
        ? `${customer.full_name} · ••••${last4}`
        : `${customer.full_name} · ${customer.customer_code}`,
    };
  });

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{t('documents.uploadTitle')}</h1>
        <p className="mt-1 text-sm text-slate-500">{t('documents.uploadSubtitle')}</p>
      </div>

      {/*
        The preselected id is only a convenience. It is checked server-side against the
        caller's organization in the upload-intent route, so a hand-edited query string
        cannot attach a document to someone else's customer.
      */}
      <UploadForm
        customers={customers}
        defaultCustomerId={
          customers.some((customer) => customer.id === customerId) ? (customerId ?? null) : null
        }
      />
    </div>
  );
}
