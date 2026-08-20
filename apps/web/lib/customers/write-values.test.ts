/**
 * Tests for the extraction → profile write path.
 *
 * This is the code that decides what an accepted extraction actually changes on a customer
 * record, so the cases that matter are the ones where a bug would silently corrupt or leak
 * data: clobbering an address the operator typed, or writing an encrypted field in plaintext.
 */

import { describe, expect, it } from 'vitest';
import { buildCustomerPatch } from './write-values';
import type { CustomerRow } from '../supabase/database.types';

type JsonColumns = Pick<
  CustomerRow,
  'address_json' | 'identity_summary_json' | 'education_json' | 'certificates_json'
>;

function row(overrides: Partial<JsonColumns> = {}): JsonColumns {
  return {
    address_json: {},
    identity_summary_json: {},
    education_json: {},
    certificates_json: {},
    ...overrides,
  };
}

describe('buildCustomerPatch', () => {
  it('writes a column-backed field directly', () => {
    const { patch } = buildCustomerPatch(row(), { 'customer.full_name': 'Sunita Devi' });
    expect(patch.full_name).toBe('Sunita Devi');
  });

  it('writes a JSON-backed field at its registry path', () => {
    const { patch } = buildCustomerPatch(row(), { 'customer.address.district': 'Sitapur' });
    expect(patch.address_json).toEqual({ current: { district: 'Sitapur' } });
  });

  it('merges into an existing JSON column rather than replacing it', () => {
    // The operator already typed a village; accepting a district must not wipe it.
    const existing = row({
      address_json: { current: { village_town_city: 'Rampur' }, permanent: { state: 'UP' } },
    });

    const { patch } = buildCustomerPatch(existing, { 'customer.address.district': 'Sitapur' });

    expect(patch.address_json).toEqual({
      current: { village_town_city: 'Rampur', district: 'Sitapur' },
      permanent: { state: 'UP' },
    });
  });

  it('does not mutate the row it was given', () => {
    const existing = row({ address_json: { current: { village_town_city: 'Rampur' } } });
    buildCustomerPatch(existing, { 'customer.address.district': 'Sitapur' });
    expect(existing.address_json).toEqual({ current: { village_town_city: 'Rampur' } });
  });

  it('collects several fields into one patch', () => {
    const { patch } = buildCustomerPatch(row(), {
      'customer.full_name': 'Sunita Devi',
      'customer.father_name': 'Ram Prasad',
      'customer.address.district': 'Sitapur',
      'customer.address.pincode': '261001',
    });

    expect(patch.full_name).toBe('Sunita Devi');
    expect(patch.father_name).toBe('Ram Prasad');
    expect(patch.address_json).toEqual({ current: { district: 'Sitapur', pincode: '261001' } });
  });

  it('keeps encrypted fields out of the patch entirely', () => {
    // PAN must never reach a plaintext column (docs/SECURITY.md §4).
    const { patch, encryptedKeys } = buildCustomerPatch(row(), { 'customer.pan': 'ZZZPD1234Q' });

    expect(encryptedKeys).toEqual(['customer.pan']);
    expect(Object.values(patch)).not.toContain('ZZZPD1234Q');
    expect(patch).toEqual({});
  });

  it('routes the Aadhaar last four to the masked identity summary', () => {
    const { patch } = buildCustomerPatch(row(), { 'customer.aadhaar_last4': '0000' });
    expect(patch.identity_summary_json).toEqual({ aadhaar_last4: '0000' });
  });

  it('refuses a field key that has no storage location', () => {
    const { patch, skipped } = buildCustomerPatch(row(), {
      'customer.aadhaar': '200000000000',
      'customer.uid': '200000000000',
    });

    expect(patch).toEqual({});
    expect(skipped.map((entry) => entry.reason)).toEqual(['forbidden', 'forbidden']);
  });

  it('skips unknown and derived fields', () => {
    const { patch, skipped } = buildCustomerPatch(row(), {
      'customer.not_a_real_field': 'x',
      'customer.age': '33',
    });

    expect(patch).toEqual({});
    expect(skipped).toEqual([
      { key: 'customer.not_a_real_field', reason: 'unknown_field' },
      // Age is computed from the date of birth at read time, never stored (§11.2).
      { key: 'customer.age', reason: 'derived' },
    ]);
  });

  it('clears a column when the accepted value is blank', () => {
    const { patch } = buildCustomerPatch(row(), { 'customer.father_name': '   ' });
    expect(patch.father_name).toBeNull();
  });
});
