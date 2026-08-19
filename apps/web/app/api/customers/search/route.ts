import { z } from 'zod';
import { maskLast4 } from '@assistigo/core';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, ok, parseQuery } from '@/lib/api/response';
import type { CustomerSearchRow } from '@/lib/supabase/database.types';

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  district: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

/**
 * GET /api/customers/search
 *
 * Fast lookup for the customer selector, in the dashboard and in the extension (§7.3.2, §7.4.3).
 *
 * The response carries only what is needed to pick the right person: name, code, district, and
 * the last four digits of the mobile. Never the full number, and never an identity document —
 * Aadhaar is not even searchable (§19.3).
 */
export const GET = handler('api.customers.search', async (request) => {
  const context = await resolveContext(request);
  requirePermission(context, 'customer.view');

  const query = parseQuery(request, querySchema);

  const { data, error } = await context.supabase.rpc('search_customers', {
    p_organization_id: context.organization.id,
    p_query: query.q ?? null,
    p_district: query.district ?? null,
    p_state: query.state ?? null,
    p_assigned_to: null,
    p_limit: query.limit,
    p_offset: query.offset,
  });

  if (error) throw error;

  const rows = (data ?? []) as CustomerSearchRow[];

  return ok({
    customers: rows.map((row) => ({
      id: row.id,
      displayName: row.full_name,
      customerCode: row.customer_code,
      mobileLast4: maskLast4(row.mobile),
      district: row.district,
      state: row.state,
      verificationStatus: row.verification_status,
    })),
    hasMore: rows.length === query.limit,
  });
});
