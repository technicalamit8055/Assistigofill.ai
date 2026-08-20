import 'server-only';

import { z } from 'zod';
import { documentStatusAfterExtraction, extractionStatus, runExtraction } from '@assistigo/ai';
import { isDocumentType, type AllowedUploadMimeType } from '@assistigo/core';
import { downloadObject } from '../../documents/storage';
import { serverEnv } from '../../env';
import { logger } from '../../api/logger';
import type { AssistigoSupabaseClient } from '../../supabase/server';
import type { DocumentRow, Json, OrganizationRow } from '../../supabase/database.types';

/**
 * `ocr.extract` — run the extraction pipeline for one uploaded document.
 * Master spec §12.1, §17.5; docs/AI_PIPELINE.md §1.
 *
 * Idempotent: it keys the extraction row on the document, so a retried job replaces its own
 * previous attempt rather than stacking duplicates in the review queue.
 *
 * Nothing here touches a customer profile. The job's whole output is a proposal that waits for
 * a human (§12.6).
 */

const payloadSchema = z.object({ documentId: z.string().uuid() });

export type JobHandlerResult = { ok: true } | { ok: false; error: string };

export async function handleOcrExtract(
  supabase: AssistigoSupabaseClient,
  payload: unknown,
): Promise<JobHandlerResult> {
  const { documentId } = payloadSchema.parse(payload);

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    // Deleted between enqueue and run. Nothing to do, and nothing wrong.
    return { ok: true };
  }

  const document = data as DocumentRow;

  const { data: organization } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', document.organization_id)
    .maybeSingle();

  const settings = ((organization as Pick<OrganizationRow, 'settings'> | null)?.settings ??
    {}) as Record<string, unknown>;
  const aiProcessingEnabled = settings.ai_processing_enabled === true;

  try {
    const bytes = await downloadObject(supabase, document.storage_path, document.storage_bucket);

    const { extraction, rawText } = await runExtraction({
      bytes,
      mimeType: document.mime_type as AllowedUploadMimeType,
      filename: document.original_filename,
      hintedType:
        isDocumentType(document.document_type) && document.document_type !== 'unknown'
          ? document.document_type
          : null,
      providerName: serverEnv().OCR_PROVIDER,
      aiProcessingEnabled,
    });

    // One extraction row per document. `upsert` on document_id keeps a retry from queueing the
    // same fields for review twice.
    const { error: upsertError } = await supabase.from('document_extractions').upsert(
      {
        organization_id: document.organization_id,
        document_id: document.id,
        provider: extraction.provider,
        provider_request_id: extraction.providerRequestId,
        document_type: extraction.documentType,
        // Already masked by the pipeline; retained only until review (docs/AI_PIPELINE.md §7).
        raw_text: rawText,
        extracted_fields: extraction.fields as unknown as Json,
        warnings: extraction.warnings as unknown as Json,
        confidence: extraction.confidence,
        status: extractionStatus(extraction),
        error_code: null,
        reviewed_by: null,
        reviewed_at: null,
      },
      { onConflict: 'document_id' },
    );

    if (upsertError) throw upsertError;

    const { error: documentError } = await supabase
      .from('documents')
      .update({
        status: documentStatusAfterExtraction(extraction),
        // Classification is more trustworthy than the operator's guess on upload, but only
        // when it actually landed on something.
        document_type:
          extraction.documentType === 'unknown' ? document.document_type : extraction.documentType,
      })
      .eq('id', document.id);

    if (documentError) throw documentError;

    // Field count and confidence only — never a key, a label or a value (§24.2).
    logger.info('jobs.ocr_extract.completed', {
      documentId: document.id,
      provider: extraction.provider,
      fieldCount: extraction.fields.length,
      confidence: extraction.confidence,
    });

    return { ok: true };
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : 'unknown';

    await supabase.from('document_extractions').upsert(
      {
        organization_id: document.organization_id,
        document_id: document.id,
        provider: serverEnv().OCR_PROVIDER,
        document_type: document.document_type,
        extracted_fields: [] as unknown as Json,
        warnings: [] as unknown as Json,
        status: 'failed',
        // The reason is logged, not stored: a provider error string can echo back page content.
        error_code: 'EXTRACTION_FAILED',
      },
      { onConflict: 'document_id' },
    );

    await supabase.from('documents').update({ status: 'failed' }).eq('id', document.id);

    logger.error('jobs.ocr_extract.failed', { documentId: document.id, reason: message });
    return { ok: false, error: message };
  }
}
