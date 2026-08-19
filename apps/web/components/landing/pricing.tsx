import Link from 'next/link';

export function Pricing() {
  const plans = [
    {
      name: 'Starter Free',
      badge: 'Individual Users',
      price: '₹0',
      period: 'forever free',
      description: 'Ideal for trying out AI form autofill on personal applications.',
      features: [
        '50 AI Autofills per month',
        '1 Saved Candidate Profile',
        'Basic Chrome Extension access',
        'Aadhaar Masking Privacy',
        'Standard field matching',
      ],
      popular: false,
      ctaText: 'Start Free',
      ctaHref: '/sign-up',
    },
    {
      name: 'Pro Unlimited',
      badge: '⚡ Most Popular',
      price: '₹499',
      period: '/ month',
      description: 'Perfect for active job seekers, freelancers, and small digital operators.',
      features: [
        'Unlimited AI Form Autofills',
        'Unlimited Candidate Vault Profiles',
        'Document OCR (Aadhaar, PAN, Marksheets)',
        'Built-in Photo & PDF Resizer Tool',
        'Custom Field Presets & Overrides',
        'Priority Field AI Support',
      ],
      popular: true,
      ctaText: 'Get Started with Pro',
      ctaHref: '/sign-up?plan=pro',
    },
    {
      name: 'Service Centre / CSC',
      badge: 'Teams & Cyber Cafes',
      price: '₹1,299',
      period: '/ month',
      description: 'Built for high-volume CSC VLEs, cyber cafes, and service agency teams.',
      features: [
        'Up to 5 Operator Staff Logins',
        'Everything in Pro Unlimited',
        'Multi-candidate Bulk Search',
        'Audit Access Logs & CSV Export',
        'Dedicated WhatsApp & Phone Support',
        'Custom Portal Integration SLA',
      ],
      popular: false,
      ctaText: 'Start Team Trial',
      ctaHref: '/sign-up?plan=team',
    },
  ];

  return (
    <section id="pricing" className="relative py-20 bg-slate-50/70 border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold tracking-widest text-[#0066FF] uppercase">
            Transparent Pricing
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-5xl">
            Simple Plans for Everyone
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Start for free today. Upgrade anytime as your volume grows.
          </p>
        </div>

        {/* Pricing Cards Grid */}
        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3 max-w-7xl mx-auto items-stretch">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col justify-between rounded-2xl p-8 transition-all duration-300 ${plan.popular
                  ? 'border-2 border-blue-500 bg-gradient-to-b from-blue-50/80 via-white to-white shadow-xl shadow-blue-500/10 scale-[1.03]'
                  : 'border border-slate-200 bg-white shadow-sm hover:shadow-md'
                }`}
            >
              {/* Card Top */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">{plan.name}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${plan.popular
                        ? 'bg-[#0066FF] text-white shadow-sm'
                        : 'bg-slate-100 text-blue-800 border border-slate-200'
                      }`}
                  >
                    {plan.badge}
                  </span>
                </div>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-slate-900 sm:text-5xl">
                    {plan.price}
                  </span>
                  <span className="text-sm text-slate-500 font-medium">{plan.period}</span>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-slate-600 font-medium">
                  {plan.description}
                </p>

                {/* Features List */}
                <div className="mt-8 space-y-3.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Included Features:
                  </span>
                  <ul className="space-y-3 text-xs sm:text-sm text-slate-700 font-medium">
                    {plan.features.map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <svg className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* CTA Button */}
              <div className="mt-10">
                <Link
                  href={plan.ctaHref}
                  className={`block w-full rounded-xl py-3.5 text-center text-xs font-bold transition-all sm:text-sm ${plan.popular
                      ? 'bg-gradient-to-r from-[#0066FF] via-blue-600 to-cyan-500 text-white shadow-md shadow-blue-500/25 hover:opacity-95'
                      : 'bg-slate-100 text-slate-900 hover:bg-slate-200 border border-slate-200'
                    }`}
                >
                  {plan.ctaText}
                </Link>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
