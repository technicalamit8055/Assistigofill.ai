import Link from 'next/link';
import { Badge, Button } from '@assistigo/ui';
import { ORG_ROLE_LABELS } from '@assistigo/core';
import { requireSession } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n/server';
import { localised } from '@/lib/i18n';
import { Sidebar } from '@/components/app-shell/sidebar';
import { LocaleSwitcher } from '@/components/app-shell/locale-switcher';
import { signOutAction } from '../(auth)/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const { t, locale } = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/dashboard" className="text-base font-semibold text-slate-900">
              {t('app.name')}
            </Link>
            <span className="hidden truncate text-sm text-slate-500 sm:block">
              {session.organization.name}
            </span>
            <Badge tone="neutral">{localised(ORG_ROLE_LABELS[session.role], locale)}</Badge>
          </div>

          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                {t('common.signOut')}
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-6 px-4 py-5">
        <aside className="hidden w-52 shrink-0 lg:block">
          <Sidebar permissions={[...session.permissions]} />
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Operators work on desktops (spec §5.1), but a small screen must still be usable. */}
      <div className="border-t border-slate-200 bg-white px-4 py-2 lg:hidden">
        <Sidebar permissions={[...session.permissions]} />
      </div>
    </div>
  );
}
