/**
 * Role-scoped denial within a single organization. Master spec §18.3, docs/DATABASE.md §8
 * items 3-4, docs/SECURITY.md §2-3, §11 checklist item "billing_admin cannot read documents".
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, setupFixture, teardownFixture, type RlsFixture } from './harness';

let fixture: RlsFixture;
let customerId: string;
let documentId: string;

beforeAll(async () => {
  fixture = await setupFixture();
  const owner = fixture.orgA.usersByRole.owner.client;

  const { data: customer, error: customerError } = await owner
    .from('customers')
    .insert({ organization_id: fixture.orgA.id, full_name: 'Rls Roles Fixture Customer' })
    .select('id')
    .single();
  if (customerError) throw customerError;
  customerId = customer.id as string;

  const { error: fieldValueError } = await owner.from('customer_field_values').insert({
    organization_id: fixture.orgA.id,
    customer_id: customerId,
    field_key: 'customer.notes_test',
    value_text: 'fixture',
  });
  if (fieldValueError) throw fieldValueError;

  const { data: document, error: documentError } = await owner
    .from('documents')
    .insert({
      organization_id: fixture.orgA.id,
      customer_id: customerId,
      original_filename: 'fixture.pdf',
      storage_path: `org/${fixture.orgA.id}/customer/${customerId}/fixture/fixture.pdf`,
      mime_type: 'application/pdf',
      size_bytes: 1024,
    })
    .select('id')
    .single();
  if (documentError) throw documentError;
  documentId = document.id as string;
}, 60_000);

afterAll(async () => {
  await teardownFixture(fixture);
});

describe('viewer is read-only', () => {
  it('lets a viewer read customers', async () => {
    const { data, error } = await fixture.orgA.usersByRole.viewer.client
      .from('customers')
      .select('id')
      .eq('id', customerId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('blocks a viewer from inserting a customer', async () => {
    const { error } = await fixture.orgA.usersByRole.viewer.client
      .from('customers')
      .insert({ organization_id: fixture.orgA.id, full_name: 'Viewer Should Not Insert' });
    expect(error).not.toBeNull();
  });

  it('blocks a viewer from updating a customer', async () => {
    const { data, error } = await fixture.orgA.usersByRole.viewer.client
      .from('customers')
      .update({ notes: 'viewer edit' })
      .eq('id', customerId)
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('blocks a viewer from deleting a customer', async () => {
    const { data, error } = await fixture.orgA.usersByRole.viewer.client
      .from('customers')
      .delete()
      .eq('id', customerId)
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('blocks a viewer from reading customer_field_values (docs/SECURITY.md §2)', async () => {
    const { data, error } = await fixture.orgA.usersByRole.viewer.client
      .from('customer_field_values')
      .select('id')
      .eq('customer_id', customerId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('lets a viewer read documents but blocks upload', async () => {
    const readResult = await fixture.orgA.usersByRole.viewer.client
      .from('documents')
      .select('id')
      .eq('id', documentId);
    expect(readResult.error).toBeNull();
    expect(readResult.data).toHaveLength(1);

    const writeResult = await fixture.orgA.usersByRole.viewer.client.from('documents').insert({
      organization_id: fixture.orgA.id,
      customer_id: customerId,
      original_filename: 'viewer-upload.pdf',
      storage_path: `org/${fixture.orgA.id}/customer/${customerId}/viewer/viewer-upload.pdf`,
      mime_type: 'application/pdf',
      size_bytes: 512,
    });
    expect(writeResult.error).not.toBeNull();
  });
});

describe('billing_admin has no customer-data access', () => {
  it('blocks billing_admin from reading documents', async () => {
    const { data, error } = await fixture.orgA.usersByRole.billing_admin.client
      .from('documents')
      .select('id')
      .eq('id', documentId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('blocks billing_admin from reading customer_field_values', async () => {
    const { data, error } = await fixture.orgA.usersByRole.billing_admin.client
      .from('customer_field_values')
      .select('id')
      .eq('customer_id', customerId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('blocks billing_admin from reading customers', async () => {
    const { data, error } = await fixture.orgA.usersByRole.billing_admin.client
      .from('customers')
      .select('id')
      .eq('id', customerId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('still lets billing_admin read subscriptions', async () => {
    const { data, error } = await fixture.orgA.usersByRole.billing_admin.client
      .from('subscriptions')
      .select('id')
      .eq('organization_id', fixture.orgA.id);
    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });
});

describe('operator can do day-to-day work but not admin actions', () => {
  it('lets an operator create a customer', async () => {
    const { error } = await fixture.orgA.usersByRole.operator.client
      .from('customers')
      .insert({ organization_id: fixture.orgA.id, full_name: 'Operator Created Customer' });
    expect(error).toBeNull();
  });

  it('blocks an operator from deleting a customer (owner/manager only)', async () => {
    const { data, error } = await fixture.orgA.usersByRole.operator.client
      .from('customers')
      .delete()
      .eq('id', customerId)
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('blocks an operator from removing an organization member', async () => {
    const managerId = fixture.orgA.usersByRole.manager.id;
    const { data, error } = await fixture.orgA.usersByRole.operator.client
      .from('organization_members')
      .delete()
      .eq('organization_id', fixture.orgA.id)
      .eq('user_id', managerId)
      .select('id');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe('anonymous access', () => {
  it('returns zero rows for every tenant table read anonymously', async () => {
    const anon = anonClient();

    const customers = await anon.from('customers').select('id').eq('id', customerId);
    expect(customers.data ?? []).toEqual([]);

    const documents = await anon.from('documents').select('id').eq('id', documentId);
    expect(documents.data ?? []).toEqual([]);

    const orgs = await anon.from('organizations').select('id').eq('id', fixture.orgA.id);
    expect(orgs.data ?? []).toEqual([]);
  });
});
