import { z } from 'zod';
import { SIGNED_URL_TTL_SECONDS, notFound } from '@assistigo/core';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, ok } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';
import { createSignedDownloadUrl } from '@/lib/documents/storage';
import type { DocumentRow } from '@/lib/supabase/database.types';

const idSchema = z.string().uuid();

/**
 * POST /api/documents/:id/signed-url
 *
 * The only way to reach a document's bytes (docs/SECURITY.md §4). Buckets are private, the URL
 * expires in five minutes, and every issue is audited — a document read is a sensitive event
 * (§19.5), so it is a POST rather than a GET: issuing credentials is not a safe, cacheable read.
 */
export const POST = handler(
  'api.documents.signed_url',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'document.download');

    const id = idSchema.parse((await ctx.params).id);

    const { data, error } = await context.supabase
      .from('documents')
      .select('id, storage_bucket, storage_path, mime_type, original_filename')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw notFound('errors.not_found');

    const row = data as Pick<
      DocumentRow,
      'id' | 'storage_bucket' | 'storage_path' | 'mime_type' | 'original_filename'
    >;

    const url = await createSignedDownloadUrl(
      context.supabase,
      row.storage_path,
      row.storage_bucket,
    );

    await writeAuditLog(context, {
      action: 'document.downloaded',
      entityType: 'document',
      entityId: id,
      metadata: { mimeType: row.mime_type },
    });

    return ok({ url, expiresInSeconds: SIGNED_URL_TTL_SECONDS, mimeType: row.mime_type });
  },
);
