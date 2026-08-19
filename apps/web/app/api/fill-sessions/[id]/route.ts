import { z } from 'zod';
import { notFound, previewValue } from '@assistigo/core';
import { FILL_ACTIONS, SKIP_REASONS } from '@assistigo/form-engine';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, ok, parseBody } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';
import { recordUsage } from '@/lib/billing/entitlements';

const resultSchema = z.object({
  signature: z.string().max(200),
  action: z.enum(FILL_ACTIONS),
  skipReason: z.enum(SKIP_REASONS).nullable().optional(),
  error: z.string().max(300).nullable().optional(),
  /** Metadata the extension already had; values are never sent back to the server. */
  fieldLabel: z.string().max(300).nullable().optional(),
  inputType: z.string().max(40).optional(),
  mappedCustomerField: z.string().max(120).nullable().optional(),
  mappingSource: z
    .enum(['adapter', 'org_custom', 'history', 'dictionary', 'ai', 'manual'])
    .nullable()
    .optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
  safetyClass: z.enum(['normal', 'captcha', 'otp', 'payment', 'submit']).optional(),
  reviewRequired: z.boolean().optional(),
  /** Already masked by the extension. The server masks again rather than trust it. */
  valuePreview: z.string().max(60).nullable().optional(),
});

const bodySchema = z.object({
  status: z.enum(['detected', 'reviewed', 'filled', 'failed', 'cancelled']),
  results: z.array(resultSchema).max(500).default([]),
  errorSummary: z.string().max(500).nullable().optional(),
});

/**
 * PATCH /api/fill-sessions/:id
 *
 * Records what actually happened during a fill (spec §17.4, §18.2).
 *
 * Field *values* are never accepted here. `valuePreview` is passed through `previewValue()`
 * again on the way in, so even a compromised extension cannot write a full Aadhaar number into
 * the audit trail.
 */
export const PATCH = handler(
  'api.fill_sessions.patch',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'fill.run');

    const { id } = await ctx.params;
    const body = await parseBody(request, bodySchema);

    const { data: session } = await context.supabase
      .from('fill_sessions')
      .select('id, customer_id, portal_adapter_id')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .maybeSingle();

    if (!session) throw notFound('errors.fill_session_not_found');

    const counts = {
      filled: body.results.filter((result) => result.action === 'filled').length,
      skipped: body.results.filter((result) => result.action === 'skipped').length,
      edited: body.results.filter((result) => result.action === 'edited').length,
      failed: body.results.filter((result) => result.action === 'failed').length,
    };

    const { error: updateError } = await context.supabase
      .from('fill_sessions')
      .update({
        status: body.status,
        filled_fields_count: counts.filled,
        skipped_fields_count: counts.skipped,
        error_summary: body.errorSummary ?? null,
      })
      .eq('id', id)
      .eq('organization_id', context.organization.id);

    if (updateError) throw updateError;

    if (body.results.length > 0) {
      const rows = body.results.map((result) => ({
        organization_id: context.organization.id,
        fill_session_id: id,
        field_signature: result.signature,
        field_label: result.fieldLabel ?? null,
        input_type: result.inputType ?? 'text',
        mapped_customer_field: result.mappedCustomerField ?? null,
        mapping_source: result.mappingSource ?? null,
        // Re-masked server-side. A CHECK constraint additionally forbids a captcha/otp/payment
        // field from ever being recorded as filled (migration 0006).
        proposed_value_preview: previewValue(result.valuePreview ?? null),
        confidence: result.confidence ?? null,
        action: result.action,
        skip_reason: result.skipReason ?? null,
        safety_class: result.safetyClass ?? 'normal',
        review_required: result.reviewRequired ?? false,
        error: result.error ?? null,
      }));

      const { error: fieldsError } = await context.supabase
        .from('fill_session_fields')
        .insert(rows);
      if (fieldsError) throw fieldsError;
    }

    if (body.status === 'filled') {
      await recordUsage(context, 'fill', 1, { fillSessionId: id });
      await writeAuditLog(context, {
        action: 'fill_session.completed',
        entityType: 'fill_session',
        entityId: id,
        metadata: counts,
      });
    }

    return ok({ id, ...counts });
  },
);
