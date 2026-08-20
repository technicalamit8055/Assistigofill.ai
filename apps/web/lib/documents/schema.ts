import { z } from 'zod';
import { ALLOWED_UPLOAD_MIME_TYPES, DOCUMENT_TYPES, MAX_UPLOAD_BYTES } from '@assistigo/core';

/**
 * Request schemas for the document routes.
 * Master spec §17.3 — every external input is validated with Zod before use.
 */

export const uploadIntentSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.enum(ALLOWED_UPLOAD_MIME_TYPES, {
    errorMap: () => ({ message: 'validation.unsupported_file_type' }),
  }),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_UPLOAD_BYTES, { message: 'validation.file_too_large' }),
  customerId: z.string().uuid().nullable().optional(),
  /** What the operator says it is. The classifier treats it as a hint, never as truth. */
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  label: z.string().max(200).optional(),
});

export const documentListSchema = z.object({
  customerId: z.string().uuid().optional(),
  status: z
    .enum(['uploaded', 'processing', 'extracted', 'review_required', 'verified', 'failed'])
    .optional(),
  documentType: z.enum(DOCUMENT_TYPES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * One operator decision about one extracted field.
 *
 * `accept` takes the extractor's value, `edit` replaces it with the operator's own, `reject`
 * keeps the extraction on record but never lets it reach the profile (docs/AI_PIPELINE.md §6).
 */
export const reviewDecisionSchema = z
  .object({
    fieldKey: z.string().min(1).max(120),
    action: z.enum(['accept', 'edit', 'reject']),
    value: z.string().max(2000).optional(),
  })
  .refine((decision) => decision.action !== 'edit' || (decision.value ?? '').trim() !== '', {
    message: 'validation.value_required',
    path: ['value'],
  });

/**
 * Creating a customer *from* a document (spec §9.3) is a separate flow that does not exist yet;
 * this route updates an existing profile and refuses when the document is unattached. When that
 * flow lands it gets its own endpoint rather than a boolean here.
 */
export const reviewSchema = z.object({
  decisions: z.array(reviewDecisionSchema).min(1).max(200),
});

export type UploadIntentInput = z.output<typeof uploadIntentSchema>;
export type ReviewInput = z.output<typeof reviewSchema>;
export type ReviewDecision = z.output<typeof reviewDecisionSchema>;
