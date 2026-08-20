import { extractFromText } from '@assistigo/ai';
import { getCustomerField, isForbiddenFieldKey, isSensitiveField } from '@assistigo/core';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, ok, parseBody } from '@/lib/api/response';
import { parseTextSchema } from '@/lib/customers/text-import';

/**
 * POST /api/customers/parse-text
 *
 * Proposes `customer.*` fields from text an operator pasted (§9.3, §12.4).
 *
 * Read-only by construction: it stores nothing — no row, no raw text, no file — and returns
 * proposals for a human to review. The write happens on a separate, explicit call to
 * `POST /api/customers/:id/values`, which is the human gate this route deliberately is not.
 *
 * Because nothing is persisted, this route takes no customer id: the same parse serves an
 * existing profile and the new-customer form.
 *
 * Privacy: the pasted text is used and discarded within the request. It is never logged (the
 * handler logs only a trace id and an event name), never written to `document_extractions`,
 * and any Aadhaar-like number in it is masked by `extractFromText` before a value or a source
 * snippet is put in the response (docs/AI_PIPELINE.md §9).
 */
export const POST = handler('api.customers.parse_text', async (request) => {
  const context = await resolveContext(request);
  // Parsing proposes values for a profile, so it needs the same permission as editing one.
  // Read-only though it is, a viewer has no reason to run an extractor over pasted PII.
  requirePermission(context, 'customer.update');

  const input = await parseBody(request, parseTextSchema);
  const result = extractFromText({ text: input.text });

  return ok({
    fields: result.fields
      // Defence in depth. `extractFromText` already drops forbidden keys and anything outside
      // the dictionary; re-checking here means a change in the AI package can never widen what
      // this route is willing to describe.
      .filter((field) => !isForbiddenFieldKey(field.key) && getCustomerField(field.key))
      .map((field) => {
        const definition = getCustomerField(field.key);

        return {
          key: field.key,
          label: field.label,
          value: field.value,
          confidence: field.confidence,
          sourceText: field.sourceText,
          status: field.status,
          reviewReason: field.reviewReason,
          // The registry label, so the review UI can show "Father's name" next to whatever
          // heading the operator's text happened to use.
          fieldLabel: definition?.label ?? null,
          sensitivity: definition?.sensitivity ?? 'normal',
          sensitive: isSensitiveField(field.key),
        };
      }),
    warnings: result.warnings,
    confidence: result.confidence,
    lineCount: result.lineCount,
  });
});
