import { z } from 'zod';
import { notFound } from '@assistigo/core';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, noContent, ok } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';
import { logger } from '@/lib/api/logger';
import { removeObject } from '@/lib/documents/storage';
import type { DocumentExtractionRow, DocumentRow } from '@/lib/supabase/database.types';

const idSchema = z.string().uuid();

/** GET /api/documents/:id — metadata and the latest extraction status. */
export const GET = handler(
  'api.documents.get',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'document.view');

    const id = idSchema.parse((await ctx.params).id);

    const { data, error } = await context.supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw notFound('errors.not_found');

    const row = data as DocumentRow;

    const { data: extraction } = await context.supabase
      .from('document_extractions')
      .select('id, status, document_type, confidence, created_at')
      .eq('organization_id', context.organization.id)
      .eq('document_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const latest = extraction as Partial<DocumentExtractionRow> | null;

    return ok({
      id: row.id,
      customerId: row.customer_id,
      filename: row.original_filename,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      documentType: row.document_type,
      status: row.status,
      label: row.label,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      extraction: latest
        ? {
            id: latest.id,
            status: latest.status,
            documentType: latest.document_type,
            confidence: latest.confidence,
            createdAt: latest.created_at,
          }
        : null,
    });
  },
);

/**
 * DELETE /api/documents/:id
 *
 * Soft-deletes the record so the audit trail survives, and hard-deletes the stored bytes, which
 * are the part that actually carries the customer's data (docs/SECURITY.md §10).
 */
export const DELETE = handler(
  'api.documents.delete',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'document.delete');

    const id = idSchema.parse((await ctx.params).id);

    const { data, error } = await context.supabase
      .from('documents')
      .select('id, storage_bucket, storage_path')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw notFound('errors.not_found');

    const row = data as Pick<DocumentRow, 'id' | 'storage_bucket' | 'storage_path'>;

    // Remove the bytes first. If this fails the row stays live and the operator can retry —
    // the opposite order would leave an unreferenced object nobody can find to delete.
    try {
      await removeObject(context.supabase, row.storage_path, row.storage_bucket);
    } catch (storageError) {
      // An object that is already gone is not a failure; the goal state is "no bytes".
      logger.warn('documents.storage_remove_failed', {
        documentId: id,
        dbError: storageError instanceof Error ? storageError.message : 'unknown',
      });
    }

    const { error: updateError } = await context.supabase
      .from('documents')
      .update({ status: 'deleted', deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', context.organization.id);

    if (updateError) throw updateError;

    await writeAuditLog(context, {
      action: 'document.deleted',
      entityType: 'document',
      entityId: id,
    });

    return noContent();
  },
);
