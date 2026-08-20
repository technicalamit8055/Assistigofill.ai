/**
 * Demo data seed. Master spec §25.4, docs/DATABASE.md §7.
 *
 * SERVER ONLY — uses the service-role key and imports node:crypto via
 * @assistigo/core/privacy/crypto. Never import this from apps/web at runtime; it is invoked only
 * by scripts/seed-demo-data.ts.
 *
 * Idempotent: reruns against the same Supabase find the demo org by its fixed slug-like name and
 * wipe its previously seeded rows first, so `npm run db:reset && npm run db:seed` is always safe.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { encryptField } from '@assistigo/core/privacy/crypto';
import { maskPan, maskAccountNumber } from '@assistigo/core';
import { DEMO_ORGANIZATION, DEMO_MEMBERS, DEMO_PASSWORD, fakeCustomer } from './fixtures';

const CUSTOMER_COUNT = 30;

export type SeedResult = {
  organizationId: string;
  memberUserIds: Record<string, string>;
  customerIds: string[];
};

async function findOrCreateDemoOrg(admin: SupabaseClient, ownerId: string): Promise<string> {
  const { data: existing, error: findError } = await admin
    .from('organizations')
    .select('id')
    .eq('name', DEMO_ORGANIZATION.name)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) return existing.id as string;

  const { data: created, error: insertError } = await admin
    .from('organizations')
    .insert({
      name: DEMO_ORGANIZATION.name,
      business_type: DEMO_ORGANIZATION.businessType,
      city: DEMO_ORGANIZATION.city,
      district: DEMO_ORGANIZATION.district,
      state: DEMO_ORGANIZATION.state,
      created_by: ownerId,
    })
    .select('id')
    .single();
  if (insertError) throw insertError;
  return created.id as string;
}

async function wipeDemoOrgData(admin: SupabaseClient, organizationId: string): Promise<void> {
  // Children first, in FK order. Deletes are scoped to organization_id so nothing outside the
  // demo org is ever touched, however this script is invoked.
  const tables = [
    'fill_session_fields',
    'fill_sessions',
    'application_documents',
    'application_status_events',
    'applications',
    'customer_field_values',
    'documents',
    'customers',
    'org_field_mappings',
    'usage_events',
  ];
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq('organization_id', organizationId);
    if (error) throw error;
  }
}

async function findOrCreateAuthUser(
  admin: SupabaseClient,
  email: string,
  name: string,
): Promise<string> {
  // The admin API has no "find by email" list filter in older SDK versions, so page through —
  // the demo org only ever has a handful of users, this is not a scale concern.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((user) => user.email === email);
    if (found) return found.id;
    if (data.users.length < 200) break;
    page += 1;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name, demo_seed: true },
  });
  if (createError) throw createError;
  return created.user.id;
}

async function upsertMembership(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  role: string,
): Promise<void> {
  const { error } = await admin
    .from('organization_members')
    .upsert(
      { organization_id: organizationId, user_id: userId, role, status: 'active' },
      { onConflict: 'organization_id,user_id' },
    );
  if (error) throw error;
}

async function seedCustomers(
  admin: SupabaseClient,
  organizationId: string,
  operatorId: string,
): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < CUSTOMER_COUNT; i++) {
    const fake = fakeCustomer(i);
    const { data: customer, error } = await admin
      .from('customers')
      .insert({
        organization_id: organizationId,
        full_name: fake.fullName,
        mobile: fake.mobile,
        date_of_birth: fake.dateOfBirth,
        gender: fake.gender,
        category: fake.category,
        father_name: fake.fatherName,
        mother_name: fake.motherName,
        verification_status: 'customer_confirmed',
        address_json: {
          current: {
            village_town_city: fake.village,
            district: fake.district,
            state: fake.state,
            pincode: fake.pincode,
          },
          permanent_same_as_current: true,
        },
        identity_summary_json: {
          aadhaar_last4: fake.aadhaarLast4,
          pan_masked: maskPan(fake.pan),
          bank: {
            name: fake.bankName,
            account_masked: maskAccountNumber(fake.accountNumber),
            ifsc: fake.ifsc,
          },
        },
        created_by: operatorId,
        updated_by: operatorId,
      })
      .select('id')
      .single();
    if (error) throw error;
    ids.push(customer.id as string);

    const aad = `${organizationId}:${customer.id}:customer.pan`;
    const { error: fieldError } = await admin.from('customer_field_values').insert([
      {
        organization_id: organizationId,
        customer_id: customer.id,
        field_key: 'customer.pan',
        value_encrypted: encryptField(fake.pan, aad),
        display_value: maskPan(fake.pan),
        status: 'customer_confirmed',
        confidence: 0.98,
        created_by: operatorId,
        updated_by: operatorId,
      },
      {
        organization_id: organizationId,
        customer_id: customer.id,
        field_key: 'customer.bank.account_number',
        value_encrypted: encryptField(
          fake.accountNumber,
          `${organizationId}:${customer.id}:customer.bank.account_number`,
        ),
        display_value: maskAccountNumber(fake.accountNumber),
        status: 'customer_confirmed',
        confidence: 0.95,
        created_by: operatorId,
        updated_by: operatorId,
      },
    ]);
    if (fieldError) throw fieldError;
  }
  return ids;
}

const APPLICATION_TEMPLATES: Array<{
  title: string;
  category: 'government' | 'scholarship' | 'certificate' | 'banking';
  status:
    | 'draft'
    | 'pending_documents'
    | 'ready_to_fill'
    | 'filled'
    | 'submitted'
    | 'pending_followup'
    | 'approved'
    | 'rejected'
    | 'cancelled';
}> = [
  { title: 'Income certificate application', category: 'certificate', status: 'draft' },
  { title: 'Caste certificate application', category: 'certificate', status: 'pending_documents' },
  { title: 'Post-matric scholarship', category: 'scholarship', status: 'ready_to_fill' },
  { title: 'Ration card renewal', category: 'government', status: 'filled' },
  { title: 'PM Kisan registration', category: 'government', status: 'submitted' },
  { title: 'Bank account opening (Jan Dhan)', category: 'banking', status: 'pending_followup' },
  { title: 'Residence certificate application', category: 'certificate', status: 'approved' },
  { title: 'Old age pension scheme', category: 'government', status: 'rejected' },
  { title: 'Domicile certificate application', category: 'certificate', status: 'cancelled' },
];

async function seedApplications(
  admin: SupabaseClient,
  organizationId: string,
  customerIds: string[],
  operatorId: string,
): Promise<void> {
  for (let i = 0; i < APPLICATION_TEMPLATES.length; i++) {
    const template = APPLICATION_TEMPLATES[i]!;
    const customerId = customerIds[i % customerIds.length]!;
    const { error } = await admin.from('applications').insert({
      organization_id: organizationId,
      customer_id: customerId,
      title: template.title,
      category: template.category,
      status: template.status,
      created_by: operatorId,
    });
    if (error) throw error;
  }
}

const DEMO_ADAPTERS = [
  {
    slug: 'demo-income-certificate-portal',
    portal_name: 'Demo State e-District Portal',
    form_name: 'Income Certificate Application',
    url_patterns: ['https://demo-edistrict.example.test/income/*'],
    status: 'active' as const,
  },
  {
    slug: 'demo-scholarship-portal',
    portal_name: 'Demo National Scholarship Portal',
    form_name: 'Post-Matric Scholarship',
    url_patterns: ['https://demo-scholarships.example.test/apply/*'],
    status: 'testing' as const,
  },
  {
    slug: 'demo-bank-account-portal',
    portal_name: 'Demo Public Sector Bank',
    form_name: 'Savings Account Opening',
    url_patterns: ['https://demo-bank.example.test/accounts/open'],
    status: 'draft' as const,
  },
];

async function seedAdapters(admin: SupabaseClient): Promise<void> {
  for (const adapter of DEMO_ADAPTERS) {
    const { error } = await admin.from('portal_adapters').upsert(
      {
        organization_id: null,
        slug: adapter.slug,
        portal_name: adapter.portal_name,
        form_name: adapter.form_name,
        url_patterns: adapter.url_patterns,
        status: adapter.status,
      },
      { onConflict: 'slug', ignoreDuplicates: false },
    );
    if (error) throw error;
  }
}

export async function seedDemoData(admin: SupabaseClient): Promise<SeedResult> {
  const memberUserIds: Record<string, string> = {};
  for (const member of DEMO_MEMBERS) {
    memberUserIds[member.role] = await findOrCreateAuthUser(admin, member.email, member.name);
  }

  const ownerId = memberUserIds.owner!;
  const organizationId = await findOrCreateDemoOrg(admin, ownerId);
  await wipeDemoOrgData(admin, organizationId);

  for (const member of DEMO_MEMBERS) {
    await upsertMembership(admin, organizationId, memberUserIds[member.role]!, member.role);
  }

  const operatorId = memberUserIds.operator!;
  const customerIds = await seedCustomers(admin, organizationId, operatorId);
  await seedApplications(admin, organizationId, customerIds, operatorId);
  await seedAdapters(admin);

  return { organizationId, memberUserIds, customerIds };
}
