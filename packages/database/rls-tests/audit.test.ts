/**
 * Audit log immutability and access. Master spec §19.5, docs/DATABASE.md §8 item 5,
 * docs/SECURITY.md §6 — audit_logs is insert-only for every role, including service_role
 * (enforced by the `audit_logs_immutable` trigger in 0008_audit_and_privacy.sql, not just RLS).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupFixture, teardownFixture, type RlsFixture } from './harness';

let fixture: RlsFixture;
let auditLogId: string;

beforeAll(async () => {
  fixture = await setupFixture();

  // create_organization (called during fixture setup) already writes an
  // 'organization.created' audit row for org A — reuse it instead of inserting a second one.
  const { data, error } = await fixture.admin
    .from('audit_logs')
    .select('id')
    .eq('organization_id', fixture.orgA.id)
    .eq('action', 'organization.created')
    .single();
  if (error) throw error;
  auditLogId = data.id as string;
}, 60_000);

afterAll(async () => {
  await teardownFixture(fixture);
});

describe('audit_logs is append-only', () => {
  it('cannot be updated even by the owner', async () => {
    const { error } = await fixture.orgA.usersByRole.owner.client
      .from('audit_logs')
      .update({ action: 'tampered' })
      .eq('id', auditLogId);
    expect(error).not.toBeNull();
  });

  it('cannot be deleted even by the owner', async () => {
    const { error } = await fixture.orgA.usersByRole.owner.client
      .from('audit_logs')
      .delete()
      .eq('id', auditLogId);
    expect(error).not.toBeNull();
  });

  it('cannot be updated by the service role — the trigger has no role exception', async () => {
    const { error } = await fixture.admin
      .from('audit_logs')
      .update({ action: 'tampered' })
      .eq('id', auditLogId);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/ASSISTIGO_AUDIT_IMMUTABLE/);
  });

  it('cannot be deleted by the service role', async () => {
    const { error } = await fixture.admin.from('audit_logs').delete().eq('id', auditLogId);
    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/ASSISTIGO_AUDIT_IMMUTABLE/);
  });

  it('lets an owner or manager read their org audit log', async () => {
    const { data, error } = await fixture.orgA.usersByRole.manager.client
      .from('audit_logs')
      .select('id')
      .eq('organization_id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).not.toHaveLength(0);
  });

  it('blocks an operator from reading the audit log', async () => {
    const { data, error } = await fixture.orgA.usersByRole.operator.client
      .from('audit_logs')
      .select('id')
      .eq('organization_id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('blocks org B from reading org A audit log entries', async () => {
    const { data, error } = await fixture.orgB.usersByRole.owner.client
      .from('audit_logs')
      .select('id')
      .eq('organization_id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('lets any member insert an audit row for their own org', async () => {
    const { error } = await fixture.orgA.usersByRole.operator.client.from('audit_logs').insert({
      organization_id: fixture.orgA.id,
      actor_type: 'user',
      action: 'customer.created',
      entity_type: 'customer',
      sensitivity: 'normal',
    });
    expect(error).toBeNull();
  });

  it('blocks inserting an audit row into another organization', async () => {
    const { error } = await fixture.orgA.usersByRole.operator.client.from('audit_logs').insert({
      organization_id: fixture.orgB.id,
      actor_type: 'user',
      action: 'customer.created',
      entity_type: 'customer',
      sensitivity: 'normal',
    });
    expect(error).not.toBeNull();
  });
});
