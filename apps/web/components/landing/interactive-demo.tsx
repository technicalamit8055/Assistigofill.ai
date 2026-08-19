'use client';

import { useState } from 'react';
import { AssistigoLogo } from './assistigo-logo';

interface Profile {
  id: string;
  name: string;
  category: string;
  aadhaar: string;
  pan: string;
  dob: string;
  fatherName: string;
  email: string;
  address: string;
  education: string;
}

const PROFILES: Profile[] = [
  {
    id: '1',
    name: 'Rahul Sharma',
    category: 'OBC / Student',
    aadhaar: 'XXXX-XXXX-4821',
    pan: 'ABCPS1234F',
    dob: '15-08-2001',
    fatherName: 'Rajesh Sharma',
    email: 'rahul.sharma@gmail.com',
    address: 'Flat 402, Civil Lines, Jaipur, Rajasthan 302006',
    education: 'B.Tech Computer Science (78.5%)',
  },
  {
    id: '2',
    name: 'Priya Verma',
    category: 'General / Professional',
    aadhaar: 'XXXX-XXXX-9102',
    pan: 'XYZPV5678K',
    dob: '22-03-1998',
    fatherName: 'Suresh Verma',
    email: 'priya.verma@outlook.com',
    address: 'Plot 12, Sector 4, Gandhinagar, Gujarat 382010',
    education: 'M.Sc Biotechnology (82.1%)',
  },
  {
    id: '3',
    name: 'Amit Kumar',
    category: 'SC / Applicant',
    aadhaar: 'XXXX-XXXX-3349',
    pan: 'JKLAK9012M',
    dob: '10-11-2002',
    fatherName: 'Ramesh Kumar',
    email: 'amit.kumar@yahoo.com',
    address: 'House 88, Subhash Nagar, Patna, Bihar 800001',
    education: 'Senior Secondary 12th (85.0%)',
  },
];

export function InteractiveDemo() {
  const [selectedProfileId, setSelectedProfileId] = useState<string>('1');
  const [isFilled, setIsFilled] = useState<boolean>(true);
  const [isFilling, setIsFilling] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'demo' | 'before-after'>('demo');

  const defaultProfile = PROFILES[0]!;
  const activeProfile = PROFILES.find((p) => p.id === selectedProfileId) ?? defaultProfile;

  const handleTriggerFill = () => {
    setIsFilling(true);
    setIsFilled(false);
    setTimeout(() => {
      setIsFilling(false);
      setIsFilled(true);
    }, 700);
  };

  return (
    <section id="demo" className="relative py-16 sm:py-24 bg-white overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto">
          <h2 className="text-xs font-bold tracking-widest text-[#0066FF] uppercase">
            Interactive Experience
          </h2>
          <p className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-5xl">
            See Assistigo AI in Action
          </p>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Experience how the extension detects form fields and fills them automatically with complete customer profile mapping.
          </p>

          {/* Toggle View Buttons */}
          <div className="mt-6 inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              onClick={() => setActiveTab('demo')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${activeTab === 'demo'
                ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              ⚡ Live Extension Simulator
            </button>
            <button
              onClick={() => setActiveTab('before-after')}
              className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all sm:text-sm ${activeTab === 'before-after'
                ? 'bg-[#0066FF] text-white shadow-md shadow-blue-500/25'
                : 'text-slate-600 hover:text-slate-900'
                }`}
            >
              📊 Manual vs AI Comparison
            </button>
          </div>
        </div>

        {activeTab === 'demo' ? (
          /* Live Browser Window Simulator */
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden max-w-6xl mx-auto">

            {/* Simulated Browser Bar */}
            <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-100/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-3 w-3 rounded-full bg-rose-400 shrink-0" />
                <span className="h-3 w-3 rounded-full bg-amber-400 shrink-0" />
                <span className="h-3 w-3 rounded-full bg-emerald-400 shrink-0" />
                <div className="ml-2 sm:ml-4 flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-white px-3 py-1 text-xs text-slate-600 sm:w-96 truncate border border-slate-200 shadow-sm">
                  <svg className="h-3.5 w-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span className="truncate">https://serviceonline.bihar.gov.in/rtps/application-form</span>
                </div>
              </div>

              {/* Profile Picker Control */}
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-slate-500 sm:inline font-medium">Active Profile:</span>
                <select
                  value={selectedProfileId}
                  onChange={(e) => {
                    setSelectedProfileId(e.target.value);
                    handleTriggerFill();
                  }}
                  className="w-full rounded-lg bg-white border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm sm:w-auto"
                >
                  {PROFILES.map((p) => (
                    <option key={p.id} value={p.id} className="text-slate-900">
                      👤 {p.name} ({p.category})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Main Interactive Workspace */}
            <div className="grid grid-cols-1 lg:grid-cols-12 relative min-h-[500px]">

              {/* Left Column: Simulated Web Portal Form (8 cols) */}
              <div className="lg:col-span-8 p-6 sm:p-8 border-b lg:border-b-0 lg:border-r border-slate-200 bg-slate-50/50">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4 mb-6">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src="/Rtps-bihar-Photoroom.png"
                      alt="RTPS Bihar Logo"
                      className="h-12 sm:h-16 lg:h-20 w-auto object-contain shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                        LIVE FORM DETECTED
                      </span>
                      <h3 className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 mt-0.5">
                        RTPS Bihar &mdash; Certificate Service Portal
                      </h3>
                    </div>
                  </div>
                  <button
                    onClick={handleTriggerFill}
                    disabled={isFilling}
                    className="flex items-center gap-2 rounded-xl bg-[#0066FF] hover:bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition-all active:scale-95 disabled:opacity-50 shrink-0"
                  >
                    <svg className="h-4 w-4 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    {isFilling ? 'AI Filling...' : '⚡ Re-Fill Form'}
                  </button>
                </div>

                {/* Form Fields Display */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Candidate Name */}
                  <div className="relative">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      Candidate Full Name
                      {isFilled && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                          ✓ 99.9% Match
                        </span>
                      )}
                    </label>
                    <div
                      className={`mt-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-500 ${isFilled
                        ? 'border-emerald-300 bg-emerald-50/70 text-slate-900'
                        : 'border-slate-300 bg-white text-slate-400'
                        }`}
                    >
                      {isFilled ? activeProfile.name : 'Waiting for autofill...'}
                    </div>
                  </div>

                  {/* Father's Name */}
                  <div className="relative">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      Father / Guardian Name
                      {isFilled && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                          ✓ 99.8% Match
                        </span>
                      )}
                    </label>
                    <div
                      className={`mt-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-500 ${isFilled
                        ? 'border-emerald-300 bg-emerald-50/70 text-slate-900'
                        : 'border-slate-300 bg-white text-slate-400'
                        }`}
                    >
                      {isFilled ? activeProfile.fatherName : 'Waiting for autofill...'}
                    </div>
                  </div>

                  {/* Aadhaar Number */}
                  <div className="relative">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      Aadhaar ID (Masked Privacy)
                      {isFilled && (
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.2 rounded border border-blue-200">
                          🔒 Masked
                        </span>
                      )}
                    </label>
                    <div
                      className={`mt-1 rounded-lg border px-3 py-2 text-sm font-mono font-medium transition-all duration-500 ${isFilled
                        ? 'border-blue-300 bg-blue-50/70 text-blue-900'
                        : 'border-slate-300 bg-white text-slate-400'
                        }`}
                    >
                      {isFilled ? activeProfile.aadhaar : 'Waiting for autofill...'}
                    </div>
                  </div>

                  {/* Date of Birth */}
                  <div className="relative">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      Date of Birth (DD-MM-YYYY)
                      {isFilled && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                          ✓ 100% Match
                        </span>
                      )}
                    </label>
                    <div
                      className={`mt-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-500 ${isFilled
                        ? 'border-emerald-300 bg-emerald-50/70 text-slate-900'
                        : 'border-slate-300 bg-white text-slate-400'
                        }`}
                    >
                      {isFilled ? activeProfile.dob : 'Waiting for autofill...'}
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="relative sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      Email Address
                      {isFilled && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                          ✓ Verified Profile Email
                        </span>
                      )}
                    </label>
                    <div
                      className={`mt-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-500 ${isFilled
                        ? 'border-emerald-300 bg-emerald-50/70 text-slate-900'
                        : 'border-slate-300 bg-white text-slate-400'
                        }`}
                    >
                      {isFilled ? activeProfile.email : 'Waiting for autofill...'}
                    </div>
                  </div>

                  {/* Address */}
                  <div className="relative sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                      Permanent Address
                      {isFilled && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-200">
                          ✓ Auto-Mapped Address
                        </span>
                      )}
                    </label>
                    <div
                      className={`mt-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-500 ${isFilled
                        ? 'border-emerald-300 bg-emerald-50/70 text-slate-900'
                        : 'border-slate-300 bg-white text-slate-400'
                        }`}
                    >
                      {isFilled ? activeProfile.address : 'Waiting for autofill...'}
                    </div>
                  </div>
                </div>

                {/* Status bar bottom */}
                <div className="mt-6 flex flex-col gap-2 rounded-xl bg-blue-50 border border-blue-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-xs font-bold text-blue-900">
                      {isFilled ? 'Form 100% Mapped & Filled in 1.2s' : 'Ready to Autofill'}
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 font-medium">
                    Human review before submit &bull; CAPTCHA safe
                  </span>
                </div>
              </div>

              {/* Right Column: Extension Panel */}
              <div className="lg:col-span-4 p-6 bg-slate-50 flex flex-col justify-between">
                <div>
                  {/* Extension Header with Official Assistigo Logo */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <AssistigoLogo height={67} />
                    <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                      ON
                    </span>
                  </div>

                  {/* Profile Selection card */}
                  <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/80 p-3">
                    <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                      Selected Vault Profile
                    </span>
                    <p className="text-sm font-bold text-slate-900 mt-1">{activeProfile.name}</p>
                    <p className="text-xs text-slate-600 font-medium">{activeProfile.category}</p>
                  </div>

                  {/* Field Mapping Summary */}
                  <div className="mt-4 space-y-2">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Detected Fields (6/6)</span>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between rounded bg-white p-2 border border-slate-200 shadow-sm">
                        <span className="text-slate-700 font-medium">Full Name</span>
                        <span className="font-bold text-emerald-700">Matched</span>
                      </div>
                      <div className="flex justify-between rounded bg-white p-2 border border-slate-200 shadow-sm">
                        <span className="text-slate-700 font-medium">Father Name</span>
                        <span className="font-bold text-emerald-700">Matched</span>
                      </div>
                      <div className="flex justify-between rounded bg-white p-2 border border-slate-200 shadow-sm">
                        <span className="text-slate-700 font-medium">Aadhaar (Masked)</span>
                        <span className="font-bold text-blue-700">Protected</span>
                      </div>
                      <div className="flex justify-between rounded bg-white p-2 border border-slate-200 shadow-sm">
                        <span className="text-slate-700 font-medium">Date of Birth</span>
                        <span className="font-bold text-emerald-700">Matched</span>
                      </div>
                      <div className="flex justify-between rounded bg-white p-2 border border-slate-200 shadow-sm">
                        <span className="text-slate-700 font-medium">Email & Address</span>
                        <span className="font-bold text-emerald-700">Matched</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Primary Action Button */}
                <div className="mt-6">
                  <button
                    onClick={handleTriggerFill}
                    className="w-full rounded-xl bg-gradient-to-r from-[#0066FF] via-blue-600 to-cyan-500 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/25 transition-all hover:opacity-95"
                  >
                    ⚡ Autofill Form (1-Click)
                  </button>
                  <p className="mt-2 text-center text-[11px] text-slate-500 font-medium">
                    Pressing Autofill populates inputs instantly.
                  </p>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* Manual vs AI Comparison Grid */
          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2 max-w-5xl mx-auto">
            {/* The Old Way */}
            <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-6 sm:p-8 relative shadow-sm">
              <div className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 mb-4 border border-rose-200">
                ❌ THE OLD WAY (Manual Typing)
              </div>
              <h3 className="text-xl font-bold text-slate-900">15+ Minutes Per Application</h3>
              <ul className="mt-6 space-y-4 text-sm text-slate-700 font-medium">
                <li className="flex items-start gap-3">
                  <span className="text-rose-600 font-bold">✕</span>
                  <span>Constantly copy-pasting details from physical documents or notes.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-600 font-bold">✕</span>
                  <span>Frequent typing errors in Aadhaar, PAN, or spelling mistakes.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-600 font-bold">✕</span>
                  <span>Long waiting queues at Cyber Cafes & CSC Service Centres.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-rose-600 font-bold">✕</span>
                  <span>Form timeouts causing lost data and frustrating re-entries.</span>
                </li>
              </ul>
            </div>

            {/* The New Way */}
            <div className="rounded-2xl border-2 border-blue-400 bg-gradient-to-b from-blue-50/70 to-white p-6 sm:p-8 relative shadow-lg shadow-blue-500/10">
              <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 mb-4 border border-blue-200">
                ⚡ THE NEW WAY (Assistigo AI)
              </div>
              <h3 className="text-xl font-bold text-slate-900">3 Seconds 1-Click Autofill</h3>
              <ul className="mt-6 space-y-4 text-sm text-slate-800 font-medium">
                <li className="flex items-start gap-3">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Profile stored once, re-used across 100+ government & web portals.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>99.8% field recognition accuracy using smart AI mapping.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Zero data entry errors & bank-grade Aadhaar masking privacy.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span>Serve 10x more customers per day with zero stress.</span>
                </li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </section>
  );
}
