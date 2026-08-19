import { Header } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { InteractiveDemo } from '@/components/landing/interactive-demo';
import { HowItWorks } from '@/components/landing/how-it-works';
import { FeaturesGrid } from '@/components/landing/features-grid';
import { WhereItWorks } from '@/components/landing/where-it-works';
import { Pricing } from '@/components/landing/pricing';
import { FAQ } from '@/components/landing/faq';
import { Footer } from '@/components/landing/footer';

export const metadata = {
  title: 'Assistigo — AI Form Autofill Chrome Extension for CSCs & Applicants',
  description:
    'Assistigo is an AI-powered Chrome extension that auto-fills web forms in one click. Store customer data once, then fill CRM fields, government portals, job applications, and tickets instantly.',
};

/**
 * Clean Light Theme Landing Page for Assistigo.ai
 */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-500/20 selection:text-blue-900">
      <Header />
      <main>
        <Hero />
        <InteractiveDemo />
        <HowItWorks />
        <FeaturesGrid />
        <WhereItWorks />
        <Pricing />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
