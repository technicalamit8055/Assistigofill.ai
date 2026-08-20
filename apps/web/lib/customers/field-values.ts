import 'server-only';

import { providerUnavailable } from '@assistigo/core';

/**
 * Builds `customer_field_values` rows — the field-level provenance layer (docs/DATABASE.md §5).
 *
 * Two paths write accepted values into a profile, and both must land here:
 *
 *   - document review (`POST /api/documents/:id/review`), where the value came off a scan,
 *   - pasted-text import (`POST /api/customers/:id/values`), where the operator supplied it.
 *
 * They differ only in provenance. Keeping one builder means the encryption rules, the AAD
 * binding and the masking rules cannot drift apart between them — a second copy of this logic
 * is exactly how a PAN ends up in a plaintext column on one path and not the other.
 */

export type FieldValueSource = {
  /** The document the value was read from, or null when the operator supplied it directly. */
  documentId: string | null;
};

export type BuildFieldValueRowsInput = {
  organizationId: string;
  customerId: string;
  userId: string;
  source: FieldValueSource;
  /** Accepted `customer.*` values, keyed by field key. */
  accepted: Readonly<Record<string, string>>;
  /** Keys the operator explicitly rejected. */
  rejected: readonly string[];
  /** Keys whose storage kind is `encrypted`, from `buildCustomerPatch`. */
  encryptedKeys: readonly string[];
  /** Extractor confidence per key; null means a human typed the value. */
  confidenceByKey: ReadonlyMap<string, number | null>;
};

/**
 * Encrypted fields (PAN, bank account) are encrypted here and stored only in `value_encrypted`;
 * their plaintext never reaches a column (docs/SECURITY.md §4). The AAD binds each ciphertext to
 * its organization, customer and field, so a value cannot be transplanted onto another record.
 */
export async function buildFieldValueRows(
  input: BuildFieldValueRowsInput,
): Promise<Record<string, unknown>[]> {
  const encryptedSet = new Set(input.encryptedKeys);
  const rows: Record<string, unknown>[] = [];

  const { encryptField } = await import('@assistigo/core/privacy/crypto');
  const { maskPan, maskAccountNumber, maskAadhaar } = await import('@assistigo/core');

  /**
   * A missing or malformed key is a server misconfiguration, not the operator's mistake. It
   * surfaces as a typed error with its own message rather than a bare "something went wrong",
   * so whoever is on support can act on it — and the key itself never reaches the response.
   */
  const encrypt = (value: string, fieldKey: string): string => {
    try {
      return encryptField(value, `${input.organizationId}:${input.customerId}:${fieldKey}`);
    } catch {
      throw providerUnavailable('errors.encryption_unavailable');
    }
  };

  for (const [fieldKey, value] of Object.entries(input.accepted)) {
    const isEncrypted = encryptedSet.has(fieldKey);

    rows.push({
      organization_id: input.organizationId,
      customer_id: input.customerId,
      field_key: fieldKey,
      value_text: isEncrypted ? null : value,
      value_encrypted: isEncrypted ? encrypt(value, fieldKey) : null,
      display_value: displayValueFor(fieldKey, value, { maskPan, maskAccountNumber, maskAadhaar }),
      source_document_id: input.source.documentId,
      confidence: input.confidenceByKey.get(fieldKey) ?? null,
      status: 'operator_verified',
      created_by: input.userId,
      updated_by: input.userId,
    });
  }

  for (const fieldKey of input.rejected) {
    rows.push({
      organization_id: input.organizationId,
      customer_id: input.customerId,
      field_key: fieldKey,
      // A rejected value is not kept. What is kept is the fact that it was rejected, so the
      // same bad extraction is recognisable next time.
      value_text: null,
      value_encrypted: null,
      display_value: null,
      source_document_id: input.source.documentId,
      confidence: null,
      status: 'rejected',
      created_by: input.userId,
      updated_by: input.userId,
    });
  }

  return rows;
}

function displayValueFor(
  fieldKey: string,
  value: string,
  mask: {
    maskPan: (value: string | null | undefined) => string | null;
    maskAccountNumber: (value: string | null | undefined) => string | null;
    maskAadhaar: (value: string | null | undefined) => string | null;
  },
): string | null {
  if (fieldKey === 'customer.pan') return mask.maskPan(value);
  if (fieldKey === 'customer.bank.account_number') return mask.maskAccountNumber(value);
  if (fieldKey === 'customer.aadhaar_last4') return mask.maskAadhaar(value);
  return null;
}
