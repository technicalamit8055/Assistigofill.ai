'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@assistigo/ui';
import type { Permission } from '@assistigo/core';
import { useTranslations } from '@/lib/i18n/client';

type NavItem = {
  href: string;
  labelKey: string;
  /** Hidden when the role lacks this permission. The server gates the page as well. */
  permission?: Permission;
};

const PRIMARY: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.home' },
  { href: '/customers', labelKey: 'nav.customers', permission: 'customer.view' },
  { href: '/documents', labelKey: 'nav.documents', permission: 'document.view' },
  { href: '/document-tools', labelKey: 'nav.documentTools', permission: 'documenttool.use' },
  { href: '/applications', labelKey: 'nav.applications', permission: 'application.view' },
];

const SECONDARY: NavItem[] = [
  { href: '/form-library', labelKey: 'nav.formLibrary', permission: 'fill.run' },
  { href: '/fill-sessions', labelKey: 'nav.fillSessions', permission: 'fill.run' },
  { href: '/billing', labelKey: 'nav.billing', permission: 'billing.view' },
  { href: '/settings', labelKey: 'nav.settings' },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const t = useTranslations();
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'block rounded-md px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-brand-50 font-medium text-brand-800'
          : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900',
      )}
    >
      {t(item.labelKey)}
    </Link>
  );
}

export function Sidebar({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();
  const allowed = new Set(permissions);

  const visible = (items: NavItem[]) =>
    items.filter((item) => !item.permission || allowed.has(item.permission));

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="Main" className="space-y-6">
      <div className="space-y-0.5">
        {visible(PRIMARY).map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>
      <div className="space-y-0.5 border-t border-slate-200 pt-4">
        {visible(SECONDARY).map((item) => (
          <NavLink key={item.href} item={item} active={isActive(item.href)} />
        ))}
      </div>
    </nav>
  );
}
