import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Stat,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@assistigo/ui';
import { formatIndianDate, maskMobile } from '@assistigo/core';
import { requireSession } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { CustomerRow, DashboardSummary } from '@/lib/supabase/database.types';
import { OnboardingChecklist } from './onboarding-checklist';

export const metadata = { title: 'Home' };

const EMPTY_SUMMARY: DashboardSummary = {
  fillsToday: 0,
  customersServedToday: 0,
  customersTotal: 0,
  documentsProcessedToday: 0,
  applicationsOpen: 0,
  reviewsPending: 0,
  fieldsFilledThisMonth: 0,
};

/**
 * Time saved is presented as an estimate and labelled as one (spec §8.6 — no overclaiming).
 * 12 seconds per field is a placeholder until the pilot measures it for real; Phase 10 replaces
 * this with observed data.
 */
const SECONDS_SAVED_PER_FIELD = 12;

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  return `${hours}h ${minutes}m`;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const { t } = await getTranslations();
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();

  const [summaryResult, customersResult] = await Promise.all([
    supabase.rpc('dashboard_summary', { p_organization_id: session.organization.id }),
    supabase
      .from('customers')
      .select('id, customer_code, full_name, mobile, created_at')
      .eq('organization_id', session.organization.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const summary: DashboardSummary = {
    ...EMPTY_SUMMARY,
    ...((summaryResult.data as DashboardSummary | null) ?? {}),
  };
  const recentCustomers = (customersResult.data ?? []) as Pick<
    CustomerRow,
    'id' | 'customer_code' | 'full_name' | 'mobile' | 'created_at'
  >[];

  const timeSaved = formatDuration(summary.fieldsFilledThisMonth * SECONDS_SAVED_PER_FIELD);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900">{t('dashboard.title')}</h1>
      </div>

      {params.denied ? <Alert tone="warning">{t('errors.permission_denied')}</Alert> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={t('dashboard.fillsToday')} value={summary.fillsToday} />
        <Stat label={t('dashboard.customersServed')} value={summary.customersServedToday} />
        <Stat label={t('dashboard.documentsProcessed')} value={summary.documentsProcessedToday} />
        <Stat label={t('dashboard.applicationsOpen')} value={summary.applicationsOpen} />
        <Stat
          label={t('dashboard.reviewsPending')}
          value={summary.reviewsPending}
          tone={summary.reviewsPending > 0 ? 'warning' : 'neutral'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title={t('dashboard.recentCustomers')}
            actions={
              session.permissions.has('customer.create') ? (
                <Link href="/customers/new">
                  <Button size="sm">{t('customers.new')}</Button>
                </Link>
              ) : null
            }
          >
            {recentCustomers.length === 0 ? (
              <EmptyState
                title={t('dashboard.emptyCustomers')}
                action={
                  session.permissions.has('customer.create') ? (
                    <Link href="/customers/new">
                      <Button size="sm">{t('customers.new')}</Button>
                    </Link>
                  ) : null
                }
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>{t('customers.code')}</TH>
                    <TH>{t('customers.name')}</TH>
                    <TH>{t('customers.mobile')}</TH>
                    <TH>{t('customers.created')}</TH>
                  </TR>
                </THead>
                <TBody>
                  {recentCustomers.map((customer) => (
                    <TR key={customer.id}>
                      <TD className="font-mono text-xs text-slate-500">{customer.customer_code}</TD>
                      <TD>
                        <Link
                          href={`/customers/${customer.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {customer.full_name}
                        </Link>
                      </TD>
                      {/* Masked by default; the full number needs an audited reveal (§19.3). */}
                      <TD className="masked-value">{maskMobile(customer.mobile) ?? '—'}</TD>
                      <TD className="text-slate-500">
                        {formatIndianDate(customer.created_at.slice(0, 10)) ?? '—'}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <OnboardingChecklist
            hasCustomers={summary.customersTotal > 0}
            hasDocuments={summary.documentsProcessedToday > 0}
          />

          <Card title={t('dashboard.timeSaved')}>
            <p className="text-2xl font-semibold tabular-nums text-slate-900">{timeSaved}</p>
            <p className="mt-1 text-xs text-slate-500">
              {t('dashboard.timeSavedHint', { fields: summary.fieldsFilledThisMonth })}
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
