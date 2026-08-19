import Link from 'next/link';
import { Badge, Card } from '@assistigo/ui';
import { requireSession } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n/server';

export const metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const session = await requireSession();
  const { t } = await getTranslations();

  const links = [
    { href: '/settings/members', labelKey: 'settings.members', permission: 'member.view' },
    {
      href: '/settings/organization',
      labelKey: 'settings.organization',
      permission: 'org.settings',
    },
    { href: '/settings/security', labelKey: 'settings.security', permission: 'org.security' },
    { href: '/settings/data', labelKey: 'settings.dataRetention', permission: 'org.settings' },
    { href: '/billing', labelKey: 'nav.billing', permission: 'billing.view' },
  ] as const;

  const visible = links.filter((link) => session.permissions.has(link.permission));

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">{t('settings.title')}</h1>

      <Card title={session.organization.name}>
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              {t('onboarding.businessType')}
            </dt>
            <dd className="mt-0.5 text-slate-800">
              {t(`onboarding.businessTypes.${session.organization.business_type}`)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              {t('onboarding.state')}
            </dt>
            <dd className="mt-0.5 text-slate-800">{session.organization.state ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">
              {t('billing.currentPlan')}
            </dt>
            <dd className="mt-0.5">
              <Badge tone="info">{session.organization.plan_code}</Badge>
            </dd>
          </div>
        </dl>
      </Card>

      <nav aria-label={t('settings.title')} className="grid gap-3 sm:grid-cols-2">
        {visible.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 transition-colors hover:border-brand-300 hover:bg-brand-50"
          >
            {t(link.labelKey)}
          </Link>
        ))}
      </nav>
    </div>
  );
}
