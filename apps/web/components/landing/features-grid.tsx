export function FeaturesGrid() {
  const features = [
    {
      title: 'Smart AI Field Recognition',
      description:
        'Detects Hindi & English input fields, select dropdowns, radio buttons, and multi-step forms on 100+ portals automatically.',
      badge: '99.8% Accuracy',
      icon: (
        <svg className="h-6 w-6 text-[#0066FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
      colSpan: 'lg:col-span-8',
    },
    {
      title: 'Document OCR & Parsing',
      description:
        'Upload Aadhaar, PAN, marksheets, or caste/income certificates. AI reads and extracts details in seconds.',
      badge: 'PDF & Images',
      icon: (
        <svg className="h-6 w-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      ),
      colSpan: 'lg:col-span-4',
    },
    {
      title: 'Multi-Candidate Customer Vault',
      description:
        'Designed for CSCs & Cyber Cafes. Search and manage thousands of customer profiles easily.',
      badge: 'Service Centre Ready',
      icon: (
        <svg className="h-6 w-6 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      colSpan: 'lg:col-span-4',
    },
    {
      title: 'Bank-Grade Privacy & Aadhaar Masking',
      description:
        'Only last 4 digits of Aadhaar stored. Document links are short-lived, sensitive fields masked, zero training on your data.',
      badge: 'Privacy First',
      icon: (
        <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
      colSpan: 'lg:col-span-8',
    },
    {
      title: 'Photo & Document Resizer Tool',
      description:
        'Crop, resize, and compress candidate photos to exact KB/pixel dimensions demanded by government portals.',
      badge: 'Instant Utility',
      icon: (
        <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
      ),
      colSpan: 'lg:col-span-6',
    },
    {
      title: 'Custom Field Overrides & Presets',
      description:
        'Save reusable preset rules for specific portals, ensuring 100% precision even on custom local forms.',
      badge: 'Full Control',
      icon: (
        <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
      ),
      colSpan: 'lg:col-span-6',
    },
  ];

  return (
    <section id="features" className="relative py-20 bg-slate-50/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold tracking-widest text-[#0066FF] uppercase">
            Built for Power Users
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-5xl">
            Everything You Need to Fill Forms 10x Faster
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Engineered specifically for service centers, cyber cafes, job applicants & digital operators.
          </p>
        </div>

        {/* Bento Grid */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {features.map((feat) => (
            <div
              key={feat.title}
              className={`${feat.colSpan} group rounded-2xl border border-slate-200/80 bg-white p-8 shadow-sm transition-all duration-300 hover:border-blue-400/60 hover:shadow-md`}
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 shadow-sm">
                  {feat.icon}
                </div>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 border border-blue-200">
                  {feat.badge}
                </span>
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900 group-hover:text-[#0066FF] transition-colors">
                {feat.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 font-medium">
                {feat.description}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
