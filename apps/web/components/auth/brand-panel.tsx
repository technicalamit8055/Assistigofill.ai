import Image from 'next/image';
import { getTranslations } from '@/lib/i18n/server';

const STAT_KEYS = [
  { key: 'auth.brand.statForms', value: '100,000+', tone: 'text-white' },
  { key: 'auth.brand.statAccuracy', value: '99.8%', tone: 'text-cyan-300' },
  { key: 'auth.brand.statClicks', value: '1-Click', tone: 'text-blue-200' },
] as const;

const POINT_KEYS = [
  'auth.brand.pointProfiles',
  'auth.brand.pointExtract',
  'auth.brand.pointReview',
] as const;

/**
 * The marketing half of the split auth screen. Hidden below `lg` so the form is the whole screen
 * on the phones most operators sign in from.
 */
export async function BrandPanel() {
  const { t } = await getTranslations();

  return (
    <aside className="relative hidden overflow-hidden bg-slate-900 lg:flex lg:w-[46%] lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      {/* Layered gradients + aura, the dark counterpart of the landing hero. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-[#0b1a3f] via-[#0d2a6b] to-slate-950"
      />
      <div
        aria-hidden
        className="animate-pulse-glow absolute -left-24 top-1/4 h-80 w-80 rounded-full bg-[#0066FF]/45"
      />
      <div
        aria-hidden
        className="animate-pulse-glow absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-cyan-400/25"
      />
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative">
        <span className="inline-flex rounded-2xl bg-white/95 px-4 py-2.5 shadow-lg shadow-blue-950/20 ring-1 ring-inset ring-white/60">
          <Image
            src="/assistfill-logo.png"
            alt={t('app.name')}
            width={360}
            height={120}
            priority
            className="h-9 w-auto object-contain object-left"
          />
        </span>
      </div>

      <div className="relative max-w-md">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-md">
          <span className="flex h-2 w-2 rounded-full bg-cyan-300" />
          <span className="text-xs font-bold text-cyan-100">{t('auth.brand.badge')}</span>
        </div>

        <h2 className="font-jakarta mt-6 text-4xl font-extrabold leading-tight tracking-tight text-white xl:text-5xl">
          {t('auth.brand.headlineLead')}{' '}
          <span className="bg-gradient-to-r from-cyan-300 to-blue-300 bg-clip-text text-transparent">
            {t('auth.brand.headlineAccent')}
          </span>
        </h2>

        <p className="mt-5 text-base leading-relaxed text-blue-100/80">
          {t('auth.brand.subtitle')}
        </p>

        <ul className="mt-8 space-y-3.5">
          {POINT_KEYS.map((key) => (
            <li key={key} className="flex items-start gap-3 text-sm text-blue-50/90">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400/20 ring-1 ring-inset ring-cyan-300/40">
                <svg
                  aria-hidden
                  className="h-3 w-3 text-cyan-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </span>
              {t(key)}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative">
        <dl className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
          {STAT_KEYS.map((stat) => (
            <div key={stat.key}>
              <dd className={`font-jakarta text-2xl font-extrabold ${stat.tone}`}>{stat.value}</dd>
              <dt className="mt-0.5 text-xs font-medium text-blue-200/70">{t(stat.key)}</dt>
            </div>
          ))}
        </dl>

        <p className="mt-6 flex items-center gap-2 text-xs text-blue-200/70">
          <svg
            aria-hidden
            className="h-4 w-4 shrink-0 text-cyan-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 3l7.5 3v5.25c0 4.28-3.02 8.26-7.5 9.75-4.48-1.49-7.5-5.47-7.5-9.75V6L12 3z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 12l1.75 1.75 3.25-3.5" />
          </svg>
          {t('auth.brand.privacyNote')}
        </p>
      </div>
    </aside>
  );
}
