import { z } from 'zod';
import { extractedFieldSchema, extractionWarningSchema } from '@assistigo/ai';
import { getCustomerField, notFound } from '@assistigo/core';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, ok } from '@/lib/api/response';
import type { DocumentExtractionRow, DocumentRow } from '@/lib/supabase/database.types';

const idSchema = z.string().uuid();

/**
 * Stored JSON is parsed on the way out, not trusted.
 *
 * The rows were written by this codebase, but a schema change or a hand-edited row would
 * otherwise reach the review UI as malformed data — and the review UI is what decides what
 * lands in a customer profile.
 */
const storedFieldsSchema = z.array(extractedFieldSchema).catch([]);
const storedWarningsSchema = z.array(extractionWarningSchema).catch([]);

/**
 * GET /api/documents/:id/extraction
 *
 * The review payload (§17.4, §12.6): every proposed field with its confidence, the reason it
 * needs review, and the snippet it was read from.
 */
export const GET = handler(
  'api.documents.extraction',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'document.view');

    const id = idSchema.parse((await ctx.params).id);

    const { data: documentRow, error: documentError } = await context.supabase
      .from('documents')
      .select('id, customer_id, original_filename, document_type, status')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (documentError) throw documentError;
    if (!documentRow) throw notFound('errors.not_found');

    const document = documentRow as Pick<
      DocumentRow,
      'id' | 'customer_id' | 'original_filename' | 'document_type' | 'status'
    >;

    const { data, error } = await context.supabase
      .from('document_extractions')
      .select('*')
      .eq('organization_id', context.organization.id)
      .eq('document_id', id)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return ok({
        documentId: id,
        documentStatus: document.status,
        customerId: document.customer_id,
        extraction: null,
      });
    }

    const row = data as DocumentExtractionRow;
    const fields = storedFieldsSchema.parse(row.extracted_fields);

    return ok({
      documentId: id,
      documentStatus: document.status,
      customerId: document.customer_id,
      extraction: {
        id: row.id,
        status: row.status,
        documentType: row.document_type,
        provider: row.provider,
        confidence: row.confidence,
        reviewedAt: row.reviewed_at,
        warnings: storedWarningsSchema.parse(row.warnings),
        fields: fields.map((field) => ({
          ...field,
          // The registry label, so the review screen can show "Father's name" next to whatever
          // the document happened to print.
          fieldLabel: getCustomerField(field.key)?.label ?? null,
          sensitivity: getCustomerField(field.key)?.sensitivity ?? 'normal',
        })),
      },
    });
  },
);
