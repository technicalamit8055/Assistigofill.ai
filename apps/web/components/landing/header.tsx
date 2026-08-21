'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AssistigoLogo } from './assistigo-logo';

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#where-it-works', label: 'Where It Works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-xl transition-all shadow-sm">
      <div className="mx-auto flex h-20 sm:h-24 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="group flex items-center shrink-0 py-1">
          <AssistigoLogo height={72} className="sm:hidden" />
          <AssistigoLogo height={96} className="hidden sm:flex" />
        </Link>

        {/* Navigation Links */}
        <nav className="hidden items-center gap-6 lg:flex xl:gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#0066FF] whitespace-nowrap"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <Link
            href="/sign-in"
            className="hidden text-sm font-semibold text-slate-700 transition-colors hover:text-[#0066FF] lg:block whitespace-nowrap"
          >
            Sign In
          </Link>
          <a
            href="https://chromewebstore.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl bg-gradient-to-r from-[#0066FF] via-blue-600 to-cyan-500 px-3 py-2 sm:px-5 sm:py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-500/40 sm:text-sm whitespace-nowrap shrink-0"
          >
            {/* Chrome Logo Icon */}
            <img
              src="/chrome.png"
              alt="Chrome"
              className="h-4 w-4 sm:h-5 sm:w-5 object-contain shrink-0"
            />
            <span className="hidden sm:inline">Add to Chrome &mdash; Free</span>
            <span className="sm:hidden">Install</span>
          </a>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav-menu"
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 lg:hidden shrink-0"
          >
            {isMenuOpen ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Nav Panel */}
      {isMenuOpen && (
        <nav
          id="mobile-nav-menu"
          className="border-t border-slate-200 bg-white px-4 py-4 shadow-lg lg:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setIsMenuOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#0066FF]"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/sign-in"
              onClick={() => setIsMenuOpen(false)}
              className="mt-2 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-[#0066FF]"
            >
              Sign In
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
