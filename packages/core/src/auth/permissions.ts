/**
 * The single definition of what each organization role may do.
 * Master spec §6.2, §18.3; mirrored by the RLS policies in
 * packages/database/migrations/0010_rls_policies.sql.
 *
 * Never inline a role string comparison anywhere else — import `can()` instead.
 */

import type { OrgRole } from './roles';

export const PERMISSIONS = [
  // customers
  'customer.view',
  'customer.create',
  'customer.update',
  'customer.delete',
  'customer.reveal_sensitive',
  'customer.export',
  // documents
  'document.view',
  'document.upload',
  'document.download',
  'document.delete',
  'extraction.review',
  'documenttool.use',
  // form filling
  'fill.run',
  'formreport.create',
  // applications
  'application.view',
  'application.create',
  'application.update',
  'application.delete',
  // organization
  'member.view',
  'member.invite',
  'member.remove',
  'member.change_role',
  'org.settings',
  'org.security',
  'org.export',
  'org.delete',
  'adapter.manage',
  // billing
  'billing.view',
  'billing.manage',
  // audit
  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const OPERATOR_PERMISSIONS: readonly Permission[] = [
  'customer.view',
  'customer.create',
  'customer.update',
  'customer.reveal_sensitive',
  'document.view',
  'document.upload',
  'document.download',
  'extraction.review',
  'documenttool.use',
  'fill.run',
  'formreport.create',
  'application.view',
  'application.create',
  'application.update',
  'member.view',
];

const MANAGER_PERMISSIONS: readonly Permission[] = [
  ...OPERATOR_PERMISSIONS,
  'customer.delete',
  'customer.export',
  'document.delete',
  'application.delete',
  'member.invite',
  'member.remove',
  'member.change_role',
  'org.settings',
  'adapter.manage',
  'audit.view',
  'billing.view',
];

const VIEWER_PERMISSIONS: readonly Permission[] = [
  'customer.view',
  'document.view',
  'application.view',
  'member.view',
];

/**
 * Billing admin manages money, not people's documents (§6.2).
 * Combining roles is a future feature; in the MVP a membership carries exactly one role.
 */
const BILLING_ADMIN_PERMISSIONS: readonly Permission[] = ['billing.view', 'billing.manage'];

const OWNER_PERMISSIONS: readonly Permission[] = PERMISSIONS;

export const ROLE_PERMISSIONS: Record<OrgRole, readonly Permission[]> = {
  owner: OWNER_PERMISSIONS,
  manager: MANAGER_PERMISSIONS,
  operator: OPERATOR_PERMISSIONS,
  viewer: VIEWER_PERMISSIONS,
  billing_admin: BILLING_ADMIN_PERMISSIONS,
};

/** Permissions granted by a set of roles (union). */
export function permissionsFor(roles: OrgRole | readonly OrgRole[]): Set<Permission> {
  const list: readonly OrgRole[] = Array.isArray(roles) ? roles : [roles as OrgRole];
  const out = new Set<Permission>();
  for (const role of list) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) out.add(permission);
  }
  return out;
}

export function can(roles: OrgRole | readonly OrgRole[], permission: Permission): boolean {
  return permissionsFor(roles).has(permission);
}

export class PermissionDeniedError extends Error {
  readonly code = 'PERMISSION_DENIED';
  readonly status = 403;
  constructor(readonly permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = 'PermissionDeniedError';
  }
}

export function assertCan(roles: OrgRole | readonly OrgRole[], permission: Permission): void {
  if (!can(roles, permission)) throw new PermissionDeniedError(permission);
}
