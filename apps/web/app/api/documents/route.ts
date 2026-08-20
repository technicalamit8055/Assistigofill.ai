import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, ok, parseQuery } from '@/lib/api/response';
import { documentListSchema } from '@/lib/documents/schema';
import type { DocumentRow } from '@/lib/supabase/database.types';

/**
 * GET /api/documents — the document list (§7.3.5).
 *
 * Metadata only. Bytes are reached through `/api/documents/:id/signed-url`, which is a separate,
 * audited action (docs/SECURITY.md §4).
 */
export const GET = handler('api.documents.list', async (request) => {
  const context = await resolveContext(request);
  requirePermission(context, 'document.view');

  const query = parseQuery(request, documentListSchema);

  let builder = context.supabase
    .from('documents')
    .select(
      'id, customer_id, original_filename, mime_type, size_bytes, document_type, status, label, expires_at, created_at',
      { count: 'exact' },
    )
    .eq('organization_id', context.organization.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(query.limit);

  if (query.customerId) builder = builder.eq('customer_id', query.customerId);
  if (query.status) builder = builder.eq('status', query.status);
  if (query.documentType) builder = builder.eq('document_type', query.documentType);

  const { data, error, count } = await builder;
  if (error) throw error;

  const rows = (data ?? []) as Partial<DocumentRow>[];

  return ok({
    documents: rows.map((row) => ({
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
    })),
    total: count ?? rows.length,
  });
});
