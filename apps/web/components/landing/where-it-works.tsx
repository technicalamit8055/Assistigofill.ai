'use client';

import { useState } from 'react';

const CATEGORIES = [
  { id: 'all', name: 'All Portals' },
  { id: 'gov', name: 'Government & CSC' },
  { id: 'jobs', name: 'Job Applications' },
  { id: 'edu', name: 'Scholarships & Admissions' },
  { id: 'crm', name: 'CRMs & Custom Web Apps' },
];

const PORTALS = [
  { name: 'SSC & Railway Portals', category: 'gov', icon: '🏛️', status: '99.8% Match' },
  { name: 'National Scholarship Portal (NSP)', category: 'edu', icon: '🎓', status: '100% Verified' },
  { name: 'State Recruitment & e-District', category: 'gov', icon: '📜', status: '99.5% Match' },
  { name: 'Workday & Greenhouse Jobs', category: 'jobs', icon: '💼', status: 'Instant Fill' },
  { name: 'LinkedIn & Indeed Applications', category: 'jobs', icon: '🌐', status: '1-Click' },
  { name: 'Naukri & Shine Candidate Forms', category: 'jobs', icon: '📄', status: '1-Click' },
  { name: 'College & University Admissions', category: 'edu', icon: '🏫', status: '99.9% Match' },
  { name: 'Salesforce & Zoho CRM Fields', category: 'crm', icon: '📊', status: 'Supported' },
  { name: 'Custom HTML Web Forms', category: 'crm', icon: '⚡', status: 'Universal AI' },
];

export function WhereItWorks() {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const filteredPortals =
    activeCategory === 'all'
      ? PORTALS
      : PORTALS.filter((p) => p.category === activeCategory);

  return (
    <section id="where-it-works" className="relative py-20 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold tracking-widest text-[#0066FF] uppercase">
            Universal Compatibility
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-5xl">
            Where Assistigo AI Works
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Works out-of-the-box across major Indian government services, global career portals, and custom web applications.
          </p>

          {/* Category Filter Chips */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`rounded-xl px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${activeCategory === cat.id
                    ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/25'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                  }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Portals Grid */}
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {filteredPortals.map((portal) => (
            <div
              key={portal.name}
              className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 transition-all duration-300 hover:border-blue-400 hover:bg-white hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{portal.icon}</span>
                <span className="text-sm font-bold text-slate-800">{portal.name}</span>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-200">
                {portal.status}
              </span>
            </div>
          ))}
        </div>

        {/* Guarantee Banner */}
        <div className="mt-12 text-center">
          <p className="text-xs text-slate-500 font-medium">
            Have a custom internal web portal or unique form? Assistigo AI smart detection adapts dynamically to custom field IDs and labels.
          </p>
        </div>

      </div>
    </section>
  );
}
