import Link from 'next/link';
import { AssistigoLogo } from './assistigo-logo';

export function Footer() {
  return (
    <footer className="relative bg-slate-900 border-t border-slate-800 text-slate-300 pt-16 pb-12 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Pre-Footer High-Impact CTA Banner */}
        <div className="relative rounded-3xl border border-blue-500/30 bg-gradient-to-r from-[#0066FF] via-blue-600 to-cyan-500 p-8 sm:p-12 mb-16 text-center shadow-2xl shadow-blue-500/20 text-white overflow-hidden">
          <div className="relative z-10 max-w-3xl mx-auto">
            <span className="inline-block rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold text-white border border-white/30 backdrop-blur-md">
              🚀 Start Saving Hours Today
            </span>
            <h2 className="mt-4 text-3xl font-extrabold text-white sm:text-5xl">
              Ready to Fill Any Web Form in Seconds?
            </h2>
            <p className="mt-4 text-blue-100 text-sm sm:text-base font-medium">
              Join thousands of CSC operators, cyber cafes & applicants auto-filling forms with 99.8% AI accuracy.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://chromewebstore.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-white px-8 py-3.5 text-sm font-extrabold text-[#0066FF] shadow-lg hover:bg-blue-50 transition-all"
              >
                <img
                  src="/chrome.png"
                  alt="Chrome"
                  className="h-5 w-5 object-contain shrink-0"
                />
                <span>Add to Chrome &mdash; It&rsquo;s Free</span>
              </a>
              <Link
                href="/sign-up"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-bold text-white hover:bg-white/20 transition-all backdrop-blur-md"
              >
                Create Account
              </Link>
            </div>
          </div>
        </div>

        {/* Footer Navigation Grid */}
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12 pb-12 border-b border-slate-800">

          {/* Brand Col */}
          <div className="md:col-span-5">
            <Link href="/" className="inline-block bg-white px-3 py-2 rounded-xl shadow-sm">
              <AssistigoLogo height={80} />
            </Link>
            <p className="mt-4 text-xs leading-relaxed text-slate-400 max-w-sm font-medium">
              India-first AI form-filling extension and candidate profile vault for CSCs, cyber cafes, VLEs, and individual applicants.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400">All Systems Operational</span>
            </div>
          </div>

          {/* Links Col 1 */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Product</h3>
            <ul className="mt-4 space-y-2.5 text-xs text-slate-400">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
              <li><a href="#where-it-works" className="hover:text-white transition-colors">Where It Works</a></li>
              <li><a href="#pricing" className="hover:text-white transition-colors">Pricing Plans</a></li>
              <li><a href="#faq" className="hover:text-white transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Links Col 2 */}
          <div className="md:col-span-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Legal & Compliance</h3>
            <ul className="mt-4 space-y-2.5 text-xs text-slate-400">
              <li><Link href="/legal/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/legal/terms" className="hover:text-white transition-colors">Terms of Service</Link></li>
              <li><Link href="/legal/acceptable-use" className="hover:text-white transition-colors">Acceptable Use Policy</Link></li>
              <li><Link href="/legal/security" className="hover:text-white transition-colors">Security & Aadhaar Compliance</Link></li>
            </ul>
          </div>

        </div>

        {/* Disclaimer & Copyright */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            &copy; {new Date().getFullYear()} Assistigo.ai. All rights reserved.
          </p>
          <p className="text-[11px] max-w-2xl text-center md:text-right">
            Disclaimer: Assistigo is an independent software tool. It is not affiliated with, endorsed by, or connected to any government department or official portal.
          </p>
        </div>

      </div>
    </footer>
  );
}
