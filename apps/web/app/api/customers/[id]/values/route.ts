import { z } from 'zod';
import { sanitizeExtractedFields, type ExtractedField } from '@assistigo/ai';
import {
  getCustomerField,
  isForbiddenFieldKey,
  notFound,
  validationFailed,
  type CustomerFieldDef,
} from '@assistigo/core';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, ok, parseBody } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';
import { applyCustomerValuesSchema } from '@/lib/customers/text-import';
import { buildCustomerPatch } from '@/lib/customers/write-values';
import { buildFieldValueRows } from '@/lib/customers/field-values';
import type { CustomerRow } from '@/lib/supabase/database.types';

const idSchema = z.string().uuid();

/**
 * POST /api/customers/:id/values
 *
 * The human gate for pasted text (§9.3, §12.6) — the only path by which a value proposed by
 * `POST /api/customers/parse-text` reaches a profile.
 *
 * Like document review, accepting writes to `customers` (the confirmed profile) *and* to
 * `customer_field_values` with status `operator_verified`, so the profile stays fast to query
 * while provenance is preserved and the form engine can autofill from either (§14).
 *
 * Unlike document review, there is no stored extraction to check a decision against: the parse
 * step deliberately persisted nothing. Every value therefore arrives from the client and is
 * treated as untrusted input:
 *
 *   - the key must exist in the field registry and must not be forbidden,
 *   - the value passes the same Aadhaar safety gate the OCR pipeline uses, so a full number
 *     cannot be smuggled in under a permitted key (docs/AI_PIPELINE.md §9),
 *   - RLS is still the second gate on the write itself.
 *
 * That is no weaker than the manual edit path, which also takes operator-typed values — it is
 * the same trust boundary, with masking added.
 */
export const POST = handler(
  'api.customers.apply_values',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'customer.update');

    const id = idSchema.parse((await ctx.params).id);
    const input = await parseBody(request, applyCustomerValuesSchema);

    const proposed: ExtractedField[] = [];
    const rejected: string[] = [];
    const confidenceByKey = new Map<string, number | null>();

    for (const decision of input.decisions) {
      if (isForbiddenFieldKey(decision.fieldKey)) {
        throw validationFailed({ fields: { decisions: 'errors.unknown_field' } });
      }

      const definition: CustomerFieldDef | undefined = getCustomerField(decision.fieldKey);
      if (!definition) throw validationFailed({ fields: { decisions: 'errors.unknown_field' } });

      if (decision.action === 'reject') {
        rejected.push(decision.fieldKey);
        continue;
      }

      const value = (decision.value ?? '').trim();
      if (value === '') continue;

      // Shaped as an `ExtractedField` so the shared safety gate below can be reused verbatim
      // rather than reimplemented — a second masking implementation is a second thing to get
      // wrong. Only `key` and `value` carry meaning here.
      proposed.push({
        key: decision.fieldKey,
        label: definition.key,
        value,
        confidence: decision.confidence ?? 0,
        sourceText: '',
        page: 1,
        bbox: null,
        status: 'ok',
        reviewReason: null,
      });

      // An edited value is the operator's own, so the extractor's confidence no longer
      // describes it. Recording null says "a human typed this", which is the stronger claim.
      confidenceByKey.set(
        decision.fieldKey,
        decision.action === 'edit' ? null : (decision.confidence ?? null),
      );
    }

    // The single Aadhaar gate (docs/AI_PIPELINE.md §9). A full number arriving under any key
    // does not survive it, whatever the client claimed.
    const accepted: Record<string, string> = {};
    for (const field of sanitizeExtractedFields(proposed)) {
      accepted[field.key] = field.value;
    }

    if (Object.keys(accepted).length === 0 && rejected.length === 0) {
      throw validationFailed({ fields: { decisions: 'validation.value_required' } });
    }

    const { data: customerRow, error: customerError } = await context.supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (customerError) throw customerError;
    if (!customerRow) throw notFound('errors.not_found');

    const customer = customerRow as CustomerRow;
    const { patch, encryptedKeys, skipped } = buildCustomerPatch(customer, accepted);

    // Provenance rows are built first, because building them encrypts the high-risk values and
    // that is the step most likely to fail on a misconfigured server. Doing it before any write
    // means a missing FIELD_ENCRYPTION_KEY leaves the profile untouched rather than half-saved.
    const fieldValueRows = await buildFieldValueRows({
      organizationId: context.organization.id,
      customerId: id,
      userId: context.userId,
      // No document: the operator supplied these values directly.
      source: { documentId: null },
      accepted,
      rejected,
      encryptedKeys,
      confidenceByKey,
    });

    if (Object.keys(patch).length > 0) {
      const { error: updateError } = await context.supabase
        .from('customers')
        .update({ ...patch, updated_by: context.userId, verification_status: 'operator_verified' })
        .eq('id', id)
        .eq('organization_id', context.organization.id);

      if (updateError) throw updateError;
    }

    if (fieldValueRows.length > 0) {
      const { error: valuesError } = await context.supabase
        .from('customer_field_values')
        .upsert(fieldValueRows, { onConflict: 'organization_id,customer_id,field_key' });

      if (valuesError) throw valuesError;
    }

    await writeAuditLog(context, {
      action: 'customer.updated',
      entityType: 'customer',
      entityId: id,
      // Which fields were decided and how — never the values themselves (§24.2).
      metadata: {
        source: 'pasted_text',
        acceptedKeys: Object.keys(accepted),
        rejectedKeys: rejected,
        skippedKeys: skipped.map((entry) => entry.key),
        editedCount: input.decisions.filter((decision) => decision.action === 'edit').length,
      },
    });

    return ok({
      customerId: id,
      acceptedCount: Object.keys(accepted).length,
      rejectedCount: rejected.length,
    });
  },
);
