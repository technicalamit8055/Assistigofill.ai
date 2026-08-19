/**
 * Organization roles and membership states.
 * Master spec §6.2, §18.2 (organization_members).
 */

export const ORG_ROLES = ['owner', 'manager', 'operator', 'viewer', 'billing_admin'] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const MEMBERSHIP_STATUSES = ['active', 'invited', 'suspended'] as const;
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];

/** Internal Assistigo staff roles. Never grant customer data access by themselves (§6.1). */
export const PLATFORM_ROLES = ['super_admin', 'support_admin'] as const;
export type PlatformRole = (typeof PLATFORM_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, { en: string; hi: string }> = {
  owner: { en: 'Owner', hi: 'मालिक' },
  manager: { en: 'Manager', hi: 'प्रबंधक' },
  operator: { en: 'Operator', hi: 'ऑपरेटर' },
  viewer: { en: 'Viewer', hi: 'दर्शक' },
  billing_admin: { en: 'Billing Admin', hi: 'बिलिंग एडमिन' },
};

/** Roles a member of `actorRole` is allowed to assign to somebody else. */
export const ASSIGNABLE_ROLES: Record<OrgRole, readonly OrgRole[]> = {
  owner: ORG_ROLES,
  // A manager may staff the centre but may never create another owner (§6.2).
  manager: ['operator', 'viewer'],
  operator: [],
  viewer: [],
  billing_admin: [],
};

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === 'string' && (ORG_ROLES as readonly string[]).includes(value);
}
