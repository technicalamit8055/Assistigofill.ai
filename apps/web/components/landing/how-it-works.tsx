export function HowItWorks() {
  const steps = [
    {
      step: '01',
      title: 'Save Customer Profile Once',
      description:
        'Type details manually or upload an Aadhaar card, PAN, or Marksheet. Our AI parses and extracts structured applicant data into your encrypted vault.',
      badge: 'Document OCR & Parsing',
      icon: (
        <svg className="h-6 w-6 text-[#0066FF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      step: '02',
      title: 'Open Web Portal & Pick Candidate',
      description:
        'Navigate to any government, job, or recruitment portal. The Assistigo Chrome Extension automatically highlights input fields and maps them to your selected profile.',
      badge: 'Smart Field Detection',
      icon: (
        <svg className="h-6 w-6 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      step: '03',
      title: 'Review, 1-Click Fill & Submit',
      description:
        'Review mapped values with AI confidence indicators. One click populates all fields. Complete CAPTCHA or OTP manually, then press submit.',
      badge: 'Human Controlled & Safe',
      icon: (
        <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
  ];

  return (
    <section id="how-it-works" className="relative py-20 bg-white border-y border-slate-200/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold tracking-widest text-[#0066FF] uppercase">
            Simple 3-Step Process
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-5xl">
            How Assistigo AI Works
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            No complex setup or training needed. Fill any application form in seconds with total confidence.
          </p>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((item) => (
            <div
              key={item.step}
              className="group relative rounded-2xl border border-slate-200/80 bg-slate-50/50 p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/60 hover:bg-white hover:shadow-xl"
            >
              {/* Step Badge */}
              <div className="flex items-center justify-between">
                <span className="text-4xl font-black text-slate-200 group-hover:text-blue-500/20 transition-colors">
                  {item.step}
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 border border-blue-100 shadow-sm">
                  {item.icon}
                </div>
              </div>

              <div className="mt-6">
                <span className="inline-block rounded-full bg-blue-50 px-3 py-1 text-[11px] font-bold text-blue-700 border border-blue-200">
                  {item.badge}
                </span>
                <h3 className="mt-3 text-xl font-bold text-slate-900 group-hover:text-[#0066FF] transition-colors">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 font-medium">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
