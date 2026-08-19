import 'server-only';

import { redirect } from 'next/navigation';
import { permissionsFor, type OrgRole, type Permission } from '@assistigo/core';
import { createSupabaseServerClient } from '../supabase/server';
import type {
  MembershipWithOrganization,
  OrganizationMemberRow,
  OrganizationRow,
} from '../supabase/database.types';

/**
 * Session helpers for Server Components.
 *
 * Route handlers use `resolveContext()` in lib/api/context.ts, which takes the incoming
 * Request. Pages have no Request object, so they use these instead — same rules, same RLS.
 */

export type PageSession = {
  userId: string;
  email: string | null;
  organization: OrganizationRow;
  membership: OrganizationMemberRow;
  role: OrgRole;
  permissions: ReadonlySet<Permission>;
};

export async function getCurrentUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

/** The caller's active memberships, most recent first. */
export async function getMemberships() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];

  const { data, error } = await supabase
    .from('organization_members')
    .select('*, organizations(*)')
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as MembershipWithOrganization[];
}

/**
 * Requires a signed-in user who belongs to an organization.
 * Redirects to sign-in or onboarding rather than throwing, because this runs during render.
 */
export async function requireSession(): Promise<PageSession> {
  const user = await getCurrentUser();
  if (!user) redirect('/sign-in');

  const memberships = await getMemberships();
  const active = memberships[0];
  if (!active?.organizations) redirect('/onboarding');

  const { organizations, ...membership } = active;
  const role = membership.role as OrgRole;

  return {
    userId: user.id,
    email: user.email ?? null,
    organization: organizations,
    membership: membership as OrganizationMemberRow,
    role,
    permissions: permissionsFor(role),
  };
}

/**
 * Page-level permission gate. The UI also hides what a role cannot do, but a user who types
 * the URL directly must land somewhere sensible rather than on a half-rendered page.
 */
export async function requirePagePermission(permission: Permission): Promise<PageSession> {
  const session = await requireSession();
  if (!session.permissions.has(permission)) redirect('/dashboard?denied=1');
  return session;
}
