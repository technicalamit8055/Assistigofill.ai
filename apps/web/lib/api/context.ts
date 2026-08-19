import 'server-only';

import {
  assertCan,
  permissionsFor,
  unauthenticated,
  notFound,
  type OrgRole,
  type Permission,
} from '@assistigo/core';
import {
  createSupabaseServerClient,
  createSupabaseTokenClient,
  type AssistigoSupabaseClient,
} from '../supabase/server';
import type {
  MembershipWithOrganization,
  OrganizationMemberRow,
  OrganizationRow,
} from '../supabase/database.types';

/**
 * One request context for both client surfaces.
 *
 * The dashboard authenticates with Supabase cookies; the Chrome extension sends a bearer
 * token. Handlers must not care which — they receive a resolved user, organization and role,
 * and a Supabase client already bound to that user's JWT so RLS remains the second gate
 * (docs/ARCHITECTURE.md §3, §5).
 */

export type ActorType = 'user' | 'extension';

export type RequestContext = {
  supabase: AssistigoSupabaseClient;
  userId: string;
  email: string | null;
  actorType: ActorType;
  organization: OrganizationRow;
  membership: OrganizationMemberRow;
  role: OrgRole;
  permissions: ReadonlySet<Permission>;
  ipAddress: string | null;
  userAgent: string | null;
};

export type AuthenticatedContext = Omit<
  RequestContext,
  'organization' | 'membership' | 'role' | 'permissions'
>;

function clientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip');
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header?.toLowerCase().startsWith('bearer ')) return null;
  const token = header.slice(7).trim();
  return token === '' ? null : token;
}

/** Resolves the caller. Throws `unauthenticated()` if there is no valid session. */
export async function resolveUser(request: Request): Promise<AuthenticatedContext> {
  const token = bearerToken(request);
  const supabase = token ? createSupabaseTokenClient(token) : await createSupabaseServerClient();

  // getUser() verifies the JWT against the auth server. getSession() would trust whatever is
  // in the cookie, which is not good enough for an authorization decision.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw unauthenticated();

  return {
    supabase,
    userId: data.user.id,
    email: data.user.email ?? null,
    actorType: token ? 'extension' : 'user',
    ipAddress: clientIp(request),
    userAgent: request.headers.get('user-agent'),
  };
}

/**
 * Resolves the caller *and* their membership of a specific organization.
 *
 * When `organizationId` is omitted, the caller's single active membership is used; if they
 * belong to several organizations, the request must name one via the `x-assistigo-org` header
 * or a query parameter, because guessing would be a cross-tenant hazard.
 */
export async function resolveContext(
  request: Request,
  organizationId?: string | null,
): Promise<RequestContext> {
  const auth = await resolveUser(request);

  const requestedOrg =
    organizationId ??
    request.headers.get('x-assistigo-org') ??
    new URL(request.url).searchParams.get('organizationId');

  let query = auth.supabase
    .from('organization_members')
    .select('*, organizations(*)')
    .eq('user_id', auth.userId)
    .eq('status', 'active');

  if (requestedOrg) query = query.eq('organization_id', requestedOrg);

  const { data, error } = await query.limit(2);
  if (error) throw error;

  const rows = (data ?? []) as unknown as MembershipWithOrganization[];

  if (rows.length === 0) throw notFound('errors.noOrganization');
  if (rows.length > 1 && !requestedOrg) {
    throw notFound('errors.organizationAmbiguous');
  }

  const membership = rows[0];
  if (!membership?.organizations) throw notFound('errors.noOrganization');

  const { organizations, ...member } = membership;

  return {
    ...auth,
    organization: organizations,
    membership: member as OrganizationMemberRow,
    role: member.role as OrgRole,
    permissions: permissionsFor(member.role as OrgRole),
  };
}

/**
 * Server-side authorization gate. This runs on every mutating handler; hiding a button in the
 * UI is not authorization (docs/DEVELOPMENT_RULES.md §4).
 */
export function requirePermission(context: RequestContext, permission: Permission): void {
  assertCan(context.role, permission);
}

export function hasPermission(context: RequestContext, permission: Permission): boolean {
  return context.permissions.has(permission);
}
