import type { ReactNode } from 'react';

/**
 * The frame every auth screen sits in. Kept separate from the pages so the sign-in, sign-up and
 * reset screens cannot drift apart visually as copy changes.
 */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative">
      {/* Soft coloured glow behind the card, echoing the landing hero aura. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-6 -top-8 -z-10 h-40 rounded-full bg-gradient-to-r from-blue-300/40 via-cyan-200/40 to-blue-200/30 blur-3xl"
      />

      <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-6 shadow-[0_18px_50px_-20px_rgba(0,102,255,0.28)] backdrop-blur-xl sm:p-8">
        <div className="space-y-1.5">
          <h1 className="font-jakarta text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            {title}
          </h1>
          {subtitle ? <p className="text-sm leading-relaxed text-slate-500">{subtitle}</p> : null}
        </div>

        <div className="mt-7">{children}</div>
      </div>

      {footer ? <div className="mt-6 text-center text-sm text-slate-600">{footer}</div> : null}
    </div>
  );
}
