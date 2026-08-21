/**
 * Turns what an operator typed into the "Edit details" form into the decision payload for
 * `POST /api/customers/:id/values` — the same generic, already-audited write path the
 * paste-text review flow uses, so an edit reaches the right storage (column, JSON path, or
 * encrypted) without a second implementation of that mapping.
 */

export type EditableFieldMeta = {
  key: string;
  /** Current value, or null when unknown — always null for an encrypted field (§19.3). */
  value: string | null;
  /** True for a field that only ever lives in `customer_field_values.value_encrypted`. */
  encrypted: boolean;
};

export type FieldEditDecision = { fieldKey: string; action: 'edit'; value: string };

/**
 * A blank input always means "leave this field as it is": the endpoint this feeds has no way
 * to clear a field, so a blank must never be forwarded as an attempt to do so. An unchanged
 * value is dropped too, so a save only ever touches what the operator actually typed. Encrypted
 * fields are never prefilled, so any non-blank value for one is by definition a change.
 */
export function buildEditDecisions(
  fields: readonly EditableFieldMeta[],
  formValues: ReadonlyMap<string, string>,
): FieldEditDecision[] {
  const decisions: FieldEditDecision[] = [];

  for (const field of fields) {
    const raw = formValues.get(field.key);
    if (raw === undefined) continue;

    const trimmed = raw.trim();
    if (trimmed === '') continue;
    if (!field.encrypted && trimmed === (field.value ?? '')) continue;

    decisions.push({ fieldKey: field.key, action: 'edit', value: trimmed });
  }

  return decisions;
}
