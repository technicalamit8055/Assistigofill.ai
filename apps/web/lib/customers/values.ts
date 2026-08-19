import 'server-only';

import { CUSTOMER_FIELDS, ageFromDateOfBirth, type CustomerFieldDef } from '@assistigo/core';
import type { CustomerRow, Json } from '../supabase/database.types';

/**
 * Flattens a customer row into the `customer.*` value map the form engine expects.
 *
 * The field registry (packages/core/src/customers/field-keys.ts) already records where each
 * value lives — a column, a JSON path, or encrypted storage — so this walks the registry rather
 * than hand-listing 90 fields. Add a field there and it becomes fillable here automatically.
 */

function readJsonPath(source: Json, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => {
    if (node && typeof node === 'object' && !Array.isArray(node)) {
      return (node as Record<string, unknown>)[key];
    }
    return undefined;
  }, source);
}

function stringify(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return null;
}

function readField(customer: CustomerRow, field: CustomerFieldDef): string | null {
  switch (field.storage.kind) {
    case 'column':
      return stringify((customer as unknown as Record<string, unknown>)[field.storage.column]);

    case 'json': {
      const container = (customer as unknown as Record<string, Json>)[field.storage.column];
      return stringify(readJsonPath(container ?? null, field.storage.path));
    }

    case 'derived':
      // Age is the only derived field today, and it is computed rather than stored (§11.2).
      return field.key === 'customer.age'
        ? stringify(ageFromDateOfBirth(customer.date_of_birth))
        : null;

    case 'encrypted':
      // Encrypted values are not read here. They come from `customer_field_values` and are
      // decrypted only for a caller holding `customer.reveal_sensitive` — see resolveEncrypted().
      return null;

    default:
      return null;
  }
}

export type CustomerValues = Record<string, string>;

/** Values available for autofill, excluding anything that lives encrypted. */
export function customerValuesFromRow(customer: CustomerRow): CustomerValues {
  const values: CustomerValues = {};
  for (const field of CUSTOMER_FIELDS) {
    const value = readField(customer, field);
    if (value !== null) values[field.key] = value;
  }
  return values;
}

/**
 * Decrypts the encrypted field values for a customer.
 *
 * Kept separate and called explicitly so that reaching for encrypted data is always a visible
 * decision at the call site, never something that happens by default (docs/SECURITY.md §4).
 * The caller must have already checked `customer.reveal_sensitive` and must write an audit
 * entry — this function does neither on the caller's behalf.
 */
export async function decryptFieldValues(
  rows: readonly { field_key: string; value_encrypted: string | null }[],
  organizationId: string,
  customerId: string,
): Promise<CustomerValues> {
  const { decryptField, isEncryptedPayload } = await import('@assistigo/core/privacy/crypto');
  const values: CustomerValues = {};

  for (const row of rows) {
    if (!row.value_encrypted || !isEncryptedPayload(row.value_encrypted)) continue;
    try {
      // The AAD binds the ciphertext to this org, customer and field, so a value cannot be
      // transplanted onto a different record.
      values[row.field_key] = decryptField(
        row.value_encrypted,
        `${organizationId}:${customerId}:${row.field_key}`,
      );
    } catch {
      // A value that will not decrypt is skipped rather than surfaced: the likely causes are a
      // rotated key or tampering, and neither should break the operator's fill.
    }
  }

  return values;
}

/** Field keys whose stored value has not yet been confirmed by a human (§14.6). */
export function unverifiedFieldKeys(
  rows: readonly { field_key: string; status: string }[],
): Set<string> {
  return new Set(rows.filter((row) => row.status === 'extracted').map((row) => row.field_key));
}
