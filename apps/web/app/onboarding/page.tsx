import { redirect } from 'next/navigation';
import { getCurrentUser, getMemberships } from '@/lib/auth/session';
import { OnboardingForm } from './onboarding-form';

export const metadata = { title: 'Set up your centre' };

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  // Somebody who already belongs to a workspace does not need to create another one by
  // accident; send them home.
  const memberships = await getMemberships();
  if (memberships.length > 0) redirect('/dashboard');

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-10">
      <OnboardingForm />
    </div>
  );
}
