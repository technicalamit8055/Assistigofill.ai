/**
 * RLS test harness. Master spec §23.3, docs/DATABASE.md §8, docs/SECURITY.md §2, §11.
 *
 * Every test in this suite talks to a REAL local Supabase (RLS cannot be exercised against a
 * mock — it is enforced by Postgres, not application code). This file only ever accepts a
 * loopback URL, so a misconfigured `.env.local` can never point these tests at a hosted project.
 *
 * Two organizations (A and B) are created, each with one member per role, so every test can
 * assert both "this role can/cannot do X" and "org A can never reach org B's rows" with the
 * same fixtures. All emails and data are fixtures — no real citizen data (spec §32.1).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ORG_ROLES, type OrgRole } from '@assistigo/core';

const RUN_ID = Math.random().toString(36).slice(2, 10);
const PASSWORD = 'AssistigoRlsTest!2026';

function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. Run "supabase start" and copy .env.example to .env.local.',
    );
  }
  if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
    throw new Error(
      `Refusing to run RLS tests against ${url} — this suite only runs against a local Supabase.`,
    );
  }
  return url;
}

function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  return key;
}

function anonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.');
  return key;
}

export function adminClient(): SupabaseClient {
  return createClient(supabaseUrl(), serviceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function anonClient(): SupabaseClient {
  return createClient(supabaseUrl(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type TestOrg = {
  id: string;
  name: string;
  usersByRole: Record<OrgRole, { id: string; email: string; client: SupabaseClient }>;
};

async function createSignedInClient(email: string): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
  return client;
}

async function createOrgWithRoles(
  admin: SupabaseClient,
  label: 'a' | 'b',
): Promise<TestOrg> {
  const usersByRole = {} as TestOrg['usersByRole'];
  let ownerId = '';

  for (const role of ORG_ROLES) {
    const email = `rls.${label}.${role}.${RUN_ID}@assistigo-rls-test.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { rls_test: true },
    });
    if (error) throw error;
    if (role === 'owner') ownerId = data.user.id;
    usersByRole[role] = { id: data.user.id, email, client: undefined as unknown as SupabaseClient };
  }

  // The owner's session creates the org, so its membership row and the audit_logs
  // `organization.created` entry are produced by the real RPC path, not a service-role insert.
  const ownerClient = await createSignedInClient(usersByRole.owner.email);
  const { data: org, error: orgError } = await ownerClient.rpc('create_organization', {
    p_name: `RLS Test Org ${label.toUpperCase()} ${RUN_ID}`,
  });
  if (orgError) throw orgError;
  usersByRole.owner.client = ownerClient;

  for (const role of ORG_ROLES) {
    if (role === 'owner') continue;
    const { error: memberError } = await admin.from('organization_members').insert({
      organization_id: org.id,
      user_id: usersByRole[role].id,
      role,
      status: 'active',
      invited_by: ownerId,
    });
    if (memberError) throw memberError;
    usersByRole[role].client = await createSignedInClient(usersByRole[role].email);
  }

  return { id: org.id as string, name: org.name as string, usersByRole };
}

export type RlsFixture = {
  admin: SupabaseClient;
  orgA: TestOrg;
  orgB: TestOrg;
};

export async function setupFixture(): Promise<RlsFixture> {
  const admin = adminClient();
  const [orgA, orgB] = await Promise.all([
    createOrgWithRoles(admin, 'a'),
    createOrgWithRoles(admin, 'b'),
  ]);
  return { admin, orgA, orgB };
}

export async function teardownFixture(fixture: RlsFixture | undefined): Promise<void> {
  // beforeAll may have thrown before the fixture was assigned (e.g. no local Supabase running);
  // afterAll still runs in that case, so this must no-op rather than throw a confusing second error.
  if (!fixture) return;
  const { admin, orgA, orgB } = fixture;
  for (const org of [orgA, orgB]) {
    // organizations cascades to every tenant table via FK "on delete cascade" (0002-0009);
    // deleting it is enough to remove all rows this fixture created.
    await admin.from('organizations').delete().eq('id', org.id);
    for (const role of ORG_ROLES) {
      await admin.auth.admin.deleteUser(org.usersByRole[role].id);
    }
  }
}

/** A signed-in client for a brand new user who is not a member of any organization. */
export async function createOutsiderClient(admin: SupabaseClient): Promise<SupabaseClient> {
  const email = `rls.outsider.${RUN_ID}.${Math.random().toString(36).slice(2, 8)}@assistigo-rls-test.test`;
  const { error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { rls_test: true },
  });
  if (error) throw error;
  return createSignedInClient(email);
}
