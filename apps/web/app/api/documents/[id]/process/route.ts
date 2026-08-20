import { z } from 'zod';
import {
  checkUsageEntitlement,
  entitlementExceeded,
  notFound,
  type AllowedUploadMimeType,
} from '@assistigo/core';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, ok } from '@/lib/api/response';
import { loadEntitlementContext } from '@/lib/billing/entitlements';
import { enqueueJob } from '@/lib/jobs/queue';
import {
  SNIFF_BYTE_COUNT,
  assertDeclaredTypeMatchesBytes,
  downloadObject,
  removeObject,
} from '@/lib/documents/storage';
import type { DocumentRow } from '@/lib/supabase/database.types';

const idSchema = z.string().uuid();

/**
 * POST /api/documents/:id/process
 *
 * Confirms an upload and queues extraction (§17.4).
 *
 * This is where the server stops trusting the client. The bytes were uploaded directly to
 * storage, so this is the first moment anything server-side has seen them: the magic bytes are
 * checked against the declared MIME type, and a file that lied about what it is gets deleted
 * rather than processed (docs/SECURITY.md §4).
 */
export const POST = handler(
  'api.documents.process',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'document.upload');

    const id = idSchema.parse((await ctx.params).id);

    const { data, error } = await context.supabase
      .from('documents')
      .select('id, storage_bucket, storage_path, mime_type, status, customer_id')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw notFound('errors.not_found');

    const row = data as Pick<
      DocumentRow,
      'id' | 'storage_bucket' | 'storage_path' | 'mime_type' | 'status' | 'customer_id'
    >;

    const entitlements = await loadEntitlementContext(context);
    const extraction = checkUsageEntitlement(entitlements, 'ai_extraction');
    if (!extraction.allowed) throw entitlementExceeded(extraction.reason);

    let bytes: Uint8Array;
    try {
      bytes = await downloadObject(context.supabase, row.storage_path, row.storage_bucket);
    } catch {
      // No object at the reserved path: the browser upload never completed.
      throw notFound('errors.upload_incomplete');
    }

    try {
      assertDeclaredTypeMatchesBytes(
        bytes.subarray(0, SNIFF_BYTE_COUNT),
        row.mime_type as AllowedUploadMimeType,
      );
    } catch (mismatch) {
      // A file that is not what it claimed has no business sitting in a private bucket.
      await removeObject(context.supabase, row.storage_path, row.storage_bucket).catch(() => {
        // Best effort — the row is marked failed either way.
      });
      await context.supabase
        .from('documents')
        .update({ status: 'failed' })
        .eq('id', id)
        .eq('organization_id', context.organization.id);
      throw mismatch;
    }

    // Queue before flipping the status. The other order leaves a document stuck in `processing`
    // with no job behind it if the enqueue fails, and nothing would ever move it on.
    // Idempotent by document id: pressing Process twice does not queue two extractions.
    const job = await enqueueJob(context.supabase, {
      type: 'ocr.extract',
      organizationId: context.organization.id,
      payload: { documentId: id },
      idempotencyKey: `ocr.extract:${id}`,
    });

    const { error: statusError } = await context.supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', id)
      .eq('organization_id', context.organization.id);

    if (statusError) throw statusError;

    return ok({ documentId: id, status: 'processing', queued: !job.deduplicated });
  },
);
