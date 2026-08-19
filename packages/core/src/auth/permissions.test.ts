import { describe, expect, it } from 'vitest';
import {
  ROLE_PERMISSIONS,
  can,
  permissionsFor,
  assertCan,
  PermissionDeniedError,
} from './permissions';
import { ASSIGNABLE_ROLES, ORG_ROLES } from './roles';

describe('role permissions', () => {
  it('defines a permission set for every role', () => {
    for (const role of ORG_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it('gives the owner everything', () => {
    expect(can('owner', 'org.delete')).toBe(true);
    expect(can('owner', 'billing.manage')).toBe(true);
    expect(can('owner', 'customer.reveal_sensitive')).toBe(true);
  });

  it('blocks an operator from billing and org security (§6.2)', () => {
    expect(can('operator', 'billing.manage')).toBe(false);
    expect(can('operator', 'billing.view')).toBe(false);
    expect(can('operator', 'org.security')).toBe(false);
    expect(can('operator', 'org.delete')).toBe(false);
  });

  it('lets an operator do day-to-day service-centre work', () => {
    expect(can('operator', 'customer.create')).toBe(true);
    expect(can('operator', 'document.upload')).toBe(true);
    expect(can('operator', 'extraction.review')).toBe(true);
    expect(can('operator', 'fill.run')).toBe(true);
    expect(can('operator', 'application.create')).toBe(true);
  });

  it('keeps a viewer read-only (§6.2)', () => {
    expect(can('viewer', 'customer.view')).toBe(true);
    expect(can('viewer', 'customer.update')).toBe(false);
    expect(can('viewer', 'customer.reveal_sensitive')).toBe(false);
    expect(can('viewer', 'fill.run')).toBe(false);
    expect(can('viewer', 'document.upload')).toBe(false);
  });

  it('never gives a billing admin customer or document access (§6.2, §18.3)', () => {
    expect(can('billing_admin', 'billing.manage')).toBe(true);
    expect(can('billing_admin', 'customer.view')).toBe(false);
    expect(can('billing_admin', 'document.view')).toBe(false);
    expect(can('billing_admin', 'document.download')).toBe(false);
    expect(can('billing_admin', 'customer.reveal_sensitive')).toBe(false);
  });

  it('stops a manager short of owner-only powers', () => {
    expect(can('manager', 'billing.manage')).toBe(false);
    expect(can('manager', 'org.delete')).toBe(false);
    expect(can('manager', 'org.security')).toBe(false);
    expect(can('manager', 'org.export')).toBe(false);
    expect(can('manager', 'member.invite')).toBe(true);
  });

  it('never lets a manager mint another owner', () => {
    expect(ASSIGNABLE_ROLES.manager).not.toContain('owner');
    expect(ASSIGNABLE_ROLES.owner).toContain('owner');
  });

  it('unions permissions across roles', () => {
    const combined = permissionsFor(['viewer', 'billing_admin']);
    expect(combined.has('customer.view')).toBe(true);
    expect(combined.has('billing.manage')).toBe(true);
    expect(combined.has('customer.delete')).toBe(false);
  });

  it('assertCan throws a typed error', () => {
    expect(() => assertCan('viewer', 'fill.run')).toThrow(PermissionDeniedError);
    expect(() => assertCan('operator', 'fill.run')).not.toThrow();
  });
});
