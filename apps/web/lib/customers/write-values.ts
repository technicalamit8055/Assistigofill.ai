import 'server-only';

import { getCustomerField, isForbiddenFieldKey, type CustomerFieldDef } from '@assistigo/core';
import type { CustomerRow, Json } from '../supabase/database.types';

/**
 * Turns a map of `customer.*` values into a database patch for the `customers` row.
 *
 * The inverse of `customerValuesFromRow` in ./values.ts, and it walks the same field registry,
 * so a field added there becomes both readable and writable without touching this file.
 *
 * Two kinds of field never appear in the patch:
 *
 *   - `encrypted` — those live only in `customer_field_values.value_encrypted`, never in a
 *     plaintext column (docs/SECURITY.md §4),
 *   - `derived` — age is computed from the date of birth at read time, never stored (§11.2).
 */

export type CustomerPatch = Record<string, Json>;

function setJsonPath(container: Record<string, Json>, path: string, value: Json): void {
  const parts = path.split('.');
  const last = parts.pop();
  if (!last) return;

  let node = container;
  for (const part of parts) {
    const existing = node[part];
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
      node = existing as Record<string, Json>;
    } else {
      const created: Record<string, Json> = {};
      node[part] = created;
      node = created;
    }
  }

  node[last] = value;
}

function asJsonObject(value: Json | undefined): Record<string, Json> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? // Cloned, so the caller's row is never mutated in place.
      (JSON.parse(JSON.stringify(value)) as Record<string, Json>)
    : {};
}

export type BuildPatchResult = {
  patch: CustomerPatch;
  /** Keys that must be written to `customer_field_values.value_encrypted` instead. */
  encryptedKeys: string[];
  /** Keys that were skipped, with the reason — surfaced for the audit metadata. */
  skipped: { key: string; reason: 'unknown_field' | 'forbidden' | 'derived' }[];
};

export function buildCustomerPatch(
  current: Pick<
    CustomerRow,
    'address_json' | 'identity_summary_json' | 'education_json' | 'certificates_json'
  >,
  values: Readonly<Record<string, string>>,
): BuildPatchResult {
  const patch: CustomerPatch = {};
  const encryptedKeys: string[] = [];
  const skipped: BuildPatchResult['skipped'] = [];

  // JSON columns are read-modify-write: an accepted district must not wipe the rest of the
  // address the operator already typed.
  const jsonColumns: Record<string, Record<string, Json>> = {
    address_json: asJsonObject(current.address_json),
    identity_summary_json: asJsonObject(current.identity_summary_json),
    education_json: asJsonObject(current.education_json),
    certificates_json: asJsonObject(current.certificates_json),
  };
  const touchedJsonColumns = new Set<string>();

  for (const [key, rawValue] of Object.entries(values)) {
    if (isForbiddenFieldKey(key)) {
      skipped.push({ key, reason: 'forbidden' });
      continue;
    }

    const field: CustomerFieldDef | undefined = getCustomerField(key);
    if (!field) {
      skipped.push({ key, reason: 'unknown_field' });
      continue;
    }

    const value = rawValue.trim();

    switch (field.storage.kind) {
      case 'column':
        patch[field.storage.column] = value === '' ? null : value;
        break;

      case 'json': {
        const column = jsonColumns[field.storage.column];
        if (!column) {
          skipped.push({ key, reason: 'unknown_field' });
          break;
        }
        setJsonPath(column, field.storage.path, value === '' ? null : value);
        touchedJsonColumns.add(field.storage.column);
        break;
      }

      case 'encrypted':
        encryptedKeys.push(key);
        break;

      case 'derived':
        skipped.push({ key, reason: 'derived' });
        break;

      default:
        skipped.push({ key, reason: 'unknown_field' });
    }
  }

  for (const column of touchedJsonColumns) {
    const value = jsonColumns[column];
    if (value) patch[column] = value;
  }

  return { patch, encryptedKeys, skipped };
}
