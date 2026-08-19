'use client';

import { useState } from 'react';

const FAQS = [
  {
    question: 'Is Assistigo safe to use on government and personal form portals?',
    answer:
      'Yes, 100%. Assistigo is a guided autofill extension. It populates input fields for your review. It NEVER submits forms automatically, NEVER bypasses CAPTCHAs, and NEVER handles OTPs. You inspect the form and press submit yourself.',
  },
  {
    question: 'How is candidate data and Aadhaar information kept private?',
    answer:
      'Privacy is engineered into our architecture. Only the last 4 digits of Aadhaar numbers are stored. Documents are stored in encrypted private storage using short-lived access links. Customer data is never sold or used to train public AI models.',
  },
  {
    question: 'Does Assistigo work on forms in Hindi or regional Indian languages?',
    answer:
      'Yes! Our AI smart detection recognizes both English and Hindi field labels, as well as complex bilingual input forms common across state e-district portals.',
  },
  {
    question: 'How do I install the Chrome extension?',
    answer:
      'Simply click the "Add to Chrome — Free" button to install directly from the Google Chrome Web Store. Pin the extension to your browser bar and sign in to access your profile vault.',
  },
  {
    question: 'Can I use Assistigo for my Cyber Cafe or CSC Service Centre with multiple staff?',
    answer:
      'Absolutely! Our Service Centre plan supports up to 5 operator logins, a shared searchable candidate vault, and complete audit access logs so you can manage your team seamlessly.',
  },
  {
    question: 'What happens if a web portal changes its form layout?',
    answer:
      'Our AI model uses contextual field semantics rather than rigid CSS selectors, allowing it to adapt dynamically when web forms update. You can also save custom field presets anytime.',
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleIndex = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="relative py-20 bg-white border-t border-slate-200">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto">
          <span className="text-xs font-bold tracking-widest text-[#0066FF] uppercase">
            Got Questions?
          </span>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900 sm:text-5xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-base text-slate-600 sm:text-lg">
            Everything you need to know about Assistigo AI form autofill extension.
          </p>
        </div>

        {/* Accordion */}
        <div className="mt-12 space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={faq.question}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? 'border-blue-300 bg-blue-50/40 shadow-sm'
                    : 'border-slate-200/80 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <button
                  onClick={() => toggleIndex(idx)}
                  className="flex w-full items-center justify-between p-6 text-left focus:outline-none"
                >
                  <span className="text-base font-bold text-slate-900 sm:text-lg pr-4">
                    {faq.question}
                  </span>
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-transform duration-300 ${
                      isOpen
                        ? 'rotate-180 border-blue-300 bg-blue-100 text-[#0066FF]'
                        : 'border-slate-200 bg-white text-slate-500'
                    }`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 pt-1 text-sm leading-relaxed text-slate-600 font-medium border-t border-slate-200/60">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
