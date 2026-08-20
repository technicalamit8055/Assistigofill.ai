/**
 * Cross-organization denial. Master spec §18.3, docs/DATABASE.md §8 items 1-2,
 * docs/SECURITY.md §11 checklist item "Cross-organization access denied in tests".
 *
 * For every tenant table: a member of org A can read their own org's rows, and a member of
 * org B reading the same query gets zero rows back — never an error, never someone else's data.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupFixture, teardownFixture, type RlsFixture } from './harness';

let fixture: RlsFixture;

beforeAll(async () => {
  fixture = await setupFixture();

  // Seed one row per tenant table in org A, as org A's owner, through the same RLS-governed
  // client the assertions use — proving the policy allows a legitimate insert too.
  const { orgA } = fixture;
  const owner = orgA.usersByRole.owner.client;

  const { data: customer, error: customerError } = await owner
    .from('customers')
    .insert({ organization_id: orgA.id, full_name: 'Rls Fixture Customer' })
    .select('id')
    .single();
  if (customerError) throw customerError;

  const { error: fieldValueError } = await owner.from('customer_field_values').insert({
    organization_id: orgA.id,
    customer_id: customer.id,
    field_key: 'customer.notes_test',
    value_text: 'fixture',
  });
  if (fieldValueError) throw fieldValueError;

  const { data: application, error: applicationError } = await owner
    .from('applications')
    .insert({ organization_id: orgA.id, customer_id: customer.id, title: 'Rls fixture application' })
    .select('id')
    .single();
  if (applicationError) throw applicationError;

  const { data: fillSession, error: fillSessionError } = await owner
    .from('fill_sessions')
    .insert({
      organization_id: orgA.id,
      customer_id: customer.id,
      page_origin: 'https://example.test',
    })
    .select('id')
    .single();
  if (fillSessionError) throw fillSessionError;

  const { error: consentError } = await owner.from('consent_records').insert({
    organization_id: orgA.id,
    customer_id: customer.id,
    consent_subject: 'customer_data',
    consent_text_version: 'v1',
  });
  if (consentError) throw consentError;

  fixture.orgA.usersByRole.owner.client = owner;
  (fixture as unknown as { seeded: Record<string, string> }).seeded = {
    customerId: customer.id,
    applicationId: application.id,
    fillSessionId: fillSession.id,
  };
}, 60_000);

afterAll(async () => {
  await teardownFixture(fixture);
});

describe('cross-organization denial', () => {
  it('lets an org A member read org A customers', async () => {
    const { data, error } = await fixture.orgA.usersByRole.operator.client
      .from('customers')
      .select('id')
      .eq('organization_id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).not.toHaveLength(0);
  });

  it('returns zero customers when org B reads org A', async () => {
    const { data, error } = await fixture.orgB.usersByRole.operator.client
      .from('customers')
      .select('id')
      .eq('organization_id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('returns zero customer_field_values when org B reads org A', async () => {
    const { data, error } = await fixture.orgB.usersByRole.operator.client
      .from('customer_field_values')
      .select('id')
      .eq('organization_id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('returns zero applications when org B reads org A', async () => {
    const { data, error } = await fixture.orgB.usersByRole.operator.client
      .from('applications')
      .select('id')
      .eq('organization_id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('returns zero fill_sessions when org B reads org A', async () => {
    const { data, error } = await fixture.orgB.usersByRole.operator.client
      .from('fill_sessions')
      .select('id')
      .eq('organization_id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('returns zero consent_records when org B reads org A', async () => {
    const { data, error } = await fixture.orgB.usersByRole.owner.client
      .from('consent_records')
      .select('id')
      .eq('organization_id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('does not let org B see org A in organizations', async () => {
    const { data, error } = await fixture.orgB.usersByRole.owner.client
      .from('organizations')
      .select('id')
      .eq('id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('does not let org B insert a customer into org A', async () => {
    const { error } = await fixture.orgB.usersByRole.owner.client
      .from('customers')
      .insert({ organization_id: fixture.orgA.id, full_name: 'Should Not Insert' });
    expect(error).not.toBeNull();
  });

  it('does not let org B update an org A application', async () => {
    const seeded = (fixture as unknown as { seeded: Record<string, string> }).seeded;
    const { data, error } = await fixture.orgB.usersByRole.owner.client
      .from('applications')
      .update({ notes: 'tampered' })
      .eq('id', seeded.applicationId)
      .select('id');
    // A cross-org update matches zero rows under RLS rather than erroring.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
