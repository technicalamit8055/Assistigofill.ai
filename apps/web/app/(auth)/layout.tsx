import Link from 'next/link';
import { getTranslations } from '@/lib/i18n/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { t } = await getTranslations();

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-base font-semibold text-slate-900">
            {t('app.name')}
          </Link>
          <p className="hidden text-sm text-slate-500 sm:block">{t('app.tagline')}</p>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <Link href="/legal/privacy" className="hover:text-slate-700">
            Privacy Policy
          </Link>
          <Link href="/legal/terms" className="hover:text-slate-700">
            Terms of Service
          </Link>
          <Link href="/legal/security" className="hover:text-slate-700">
            Security
          </Link>
        </div>
      </footer>
    </div>
  );
}
