import Link from 'next/link';
import { AssistigoLogo } from './assistigo-logo';

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-xl transition-all shadow-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href="/" className="group flex items-center shrink-0">
          <AssistigoLogo height={72} />
        </Link>

        {/* Navigation Links */}
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#0066FF]">
            Features
          </a>
          <a href="#how-it-works" className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#0066FF]">
            How It Works
          </a>
          <a href="#where-it-works" className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#0066FF]">
            Where It Works
          </a>
          <a href="#pricing" className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#0066FF]">
            Pricing
          </a>
          <a href="#faq" className="text-sm font-semibold text-slate-600 transition-colors hover:text-[#0066FF]">
            FAQ
          </a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          <Link
            href="/sign-in"
            className="hidden text-sm font-semibold text-slate-700 transition-colors hover:text-[#0066FF] sm:block whitespace-nowrap"
          >
            Sign In
          </Link>
          <a
            href="https://chromewebstore.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0066FF] via-blue-600 to-cyan-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02] hover:shadow-blue-500/40 sm:text-sm whitespace-nowrap shrink-0"
          >
            {/* Chrome Logo Icon */}
            <img
              src="/chrome.png"
              alt="Chrome"
              className="h-5 w-5 object-contain shrink-0"
            />
            <span>Add to Chrome &mdash; Free</span>
          </a>
        </div>
      </div>
    </header>
  );
}
