import { requirePagePermission } from '@/lib/auth/session';
import { getTranslations } from '@/lib/i18n/server';
import { NewCustomerForm } from './new-customer-form';

export const metadata = { title: 'New customer' };

export default async function NewCustomerPage() {
  await requirePagePermission('customer.create');
  const { t } = await getTranslations();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-lg font-semibold text-slate-900">{t('customers.new')}</h1>
      <NewCustomerForm />
    </div>
  );
}
