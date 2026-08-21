import Image from 'next/image';
import Link from 'next/link';
import { BrandPanel } from '@/components/auth/brand-panel';
import { LocaleSwitcher } from '@/components/app-shell/locale-switcher';
import { getTranslations } from '@/lib/i18n/server';

const LEGAL_LINKS = [
  { href: '/legal/privacy', key: 'legal.privacy' },
  { href: '/legal/terms', key: 'legal.terms' },
  { href: '/legal/security', key: 'legal.security' },
] as const;

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getTranslations();

  return (
    <div className="flex min-h-dvh bg-white">
      <BrandPanel />

      {/* Form half. Owns the full width below `lg`. */}
      <div className="relative flex flex-1 flex-col">
        {/* Light aura so the phone/tablet view is not a bare white sheet. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-gradient-to-b from-blue-50 via-slate-50/60 to-white"
        />

        <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label={t('app.name')}>
            <Image
              src="/Bharatfill-logo.png"
              alt={t('app.name')}
              width={480}
              height={160}
              priority
              className="h-14 w-auto object-contain object-left"
            />
          </Link>

          <Link
            href="/"
            className="hidden items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-[#0066FF] lg:inline-flex"
          >
            <svg
              aria-hidden
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12l7.5-7.5M3 12h18" />
            </svg>
            {t('auth.backToSite')}
          </Link>

          <LocaleSwitcher />
        </header>

        <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-8 sm:py-12">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="px-5 pb-8 sm:px-8">
          <div className="mx-auto flex max-w-md flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-200 pt-5 text-xs text-slate-500">
            {LEGAL_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-slate-800">
                {t(link.key)}
              </Link>
            ))}
          </div>
        </footer>
      </div>
    </div>
  );
}
