import { z } from 'zod';
import { MAX_PASTED_TEXT_LENGTH } from '@assistigo/ai';

/**
 * Request schemas for the pasted-text import routes.
 * Master spec §9.3, §17.3 — every external input is validated with Zod before use.
 */

/**
 * `POST /api/customers/parse-text` — the read-only half.
 *
 * Text in, proposed fields out. Nothing is written, so this is safe to call as the operator
 * edits their paste. The response is the review payload, not a saved record.
 */
export const parseTextSchema = z.object({
  text: z
    .string()
    .min(1, { message: 'validation.value_required' })
    // The extractor truncates rather than failing, so the cap here only rejects a body large
    // enough to be an attack rather than a paste.
    .max(MAX_PASTED_TEXT_LENGTH * 2, { message: 'validation.text_too_long' }),
});

/**
 * One operator decision about one proposed field.
 *
 * Same vocabulary as document review (lib/documents/schema.ts) so the review component is
 * shared: `accept` takes the proposed value, `edit` replaces it with the operator's own, and
 * `reject` records the refusal without ever letting the value reach the profile.
 *
 * Unlike document review there is no stored extraction to check a decision against — the parse
 * step persisted nothing. `value` is therefore required on `accept` too, and the server
 * re-validates every key against the field registry before writing.
 */
export const customerValueDecisionSchema = z
  .object({
    fieldKey: z.string().min(1).max(120),
    action: z.enum(['accept', 'edit', 'reject']),
    value: z.string().max(2000).optional(),
    /** Extractor confidence, for provenance. Absent or null means a human typed the value. */
    confidence: z.number().min(0).max(1).nullable().optional(),
  })
  .refine(
    (decision) => decision.action === 'reject' || (decision.value ?? '').trim() !== '',
    { message: 'validation.value_required', path: ['value'] },
  );

/**
 * `POST /api/customers/:id/values` — the writing half, and the only path by which a pasted
 * value reaches a profile (§12.6).
 */
export const applyCustomerValuesSchema = z.object({
  decisions: z.array(customerValueDecisionSchema).min(1).max(200),
});

export type ParseTextInput = z.output<typeof parseTextSchema>;
export type ApplyCustomerValuesInput = z.output<typeof applyCustomerValuesSchema>;
export type CustomerValueDecision = z.output<typeof customerValueDecisionSchema>;
