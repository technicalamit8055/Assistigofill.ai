export function Hero() {
  return (
    <section className="font-jakarta relative overflow-hidden bg-gradient-to-b from-blue-50/60 via-slate-50 to-white pt-12 pb-20 sm:pt-20 sm:pb-28">
      {/* Soft Blue Radial Background Aura */}
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 -translate-x-1/2 transform-gpu overflow-hidden blur-3xl sm:-top-10">
        <div
          className="aspect-[1155/678] w-[36.125rem] max-w-none -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-blue-300 to-cyan-200 opacity-40 sm:w-[72.1875rem]"
          style={{
            clipPath:
              'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
          }}
        />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">

          {/* Top Pill Badge */}
          <div className="font-inter inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-4 py-1.5 backdrop-blur-md shadow-sm">
            <span className="flex h-2 w-2 rounded-full bg-[#0066FF] animate-ping" />
            <span className="text-xs font-bold text-blue-700 sm:text-sm">
              ⚡ AI-Powered Form Autofill Chrome Extension
            </span>
            <span className="hidden text-xs text-blue-300 sm:inline">&bull;</span>
            <span className="hidden text-xs text-blue-800 sm:inline font-semibold">
              ★ 5.0 Chrome Rating
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="font-jakarta mt-8 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            Fill Any Web Form in{' '}
            <span className="bg-gradient-to-r from-[#0066FF] via-blue-600 to-cyan-500 bg-clip-text text-transparent">
              One Click
            </span>{' '}
            with AI
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg leading-relaxed text-slate-600 sm:text-xl max-w-3xl mx-auto">
            Store customer, student & applicant profiles once. Instantly auto-fill complex Indian
            government portals, CSC services, job applications, scholarships & online forms with{' '}
            <span className="text-[#0066FF] font-semibold">99.8% AI accuracy</span>.
          </p>

          {/* Action CTAs */}
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <a
              href="https://chromewebstore.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative inline-flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#0066FF] via-blue-600 to-cyan-500 px-8 py-4 text-base font-bold text-white shadow-xl shadow-blue-500/25 transition-all duration-300 hover:scale-[1.03] hover:shadow-blue-500/40 sm:w-auto"
            >
              <img
                src="/chrome.png"
                alt="Chrome"
                className="h-6 w-6 object-contain shrink-0"
              />
              <span>Add to Chrome &mdash; It&rsquo;s Free</span>
              <span className="text-blue-100 group-hover:translate-x-1 transition-transform">
                &rarr;
              </span>
            </a>

            <a
              href="#demo"
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-7 py-4 text-base font-semibold text-slate-800 shadow-sm transition-all duration-300 hover:border-blue-300 hover:bg-slate-50 sm:w-auto"
            >
              <svg className="h-5 w-5 text-[#0066FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Try Live Interactive Demo</span>
            </a>
          </div>

          {/* Key Trust Signals */}
          <div className="mt-14 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-8 sm:grid-cols-4 max-w-3xl mx-auto">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-extrabold text-slate-900">100,000+</span>
              <span className="text-xs text-slate-500 font-medium mt-0.5">Forms Filled Fast</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-extrabold text-[#0066FF]">99.8%</span>
              <span className="text-xs text-slate-500 font-medium mt-0.5">Field Accuracy</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-extrabold text-cyan-600">1-Click</span>
              <span className="text-xs text-slate-500 font-medium mt-0.5">Instant Autofill</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-extrabold text-emerald-600">100%</span>
              <span className="text-xs text-slate-500 font-medium mt-0.5">Aadhaar Safe & Masked</span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

