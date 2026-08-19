import {
  checkCustomerLimit,
  createCustomerSchema,
  customerSearchSchema,
  entitlementExceeded,
  findDuplicates,
  maskLast4,
  normalizeName,
  type DuplicateCandidateInput,
} from '@assistigo/core';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { created, handler, ok, parseBody, parseQuery } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';
import { loadEntitlementContext } from '@/lib/billing/entitlements';
import type { CustomerRow } from '@/lib/supabase/database.types';

/** GET /api/customers — the operational list (§7.3.2). */
export const GET = handler('api.customers.list', async (request) => {
  const context = await resolveContext(request);
  requirePermission(context, 'customer.view');

  const query = parseQuery(request, customerSearchSchema);

  let builder = context.supabase
    .from('customers')
    .select('id, customer_code, full_name, mobile, address_json, verification_status, created_at', {
      count: 'exact',
    })
    .eq('organization_id', context.organization.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(query.limit);

  if (query.assignedTo) builder = builder.eq('assigned_to', query.assignedTo);
  if (query.createdFrom) builder = builder.gte('created_at', query.createdFrom);
  if (query.createdTo) builder = builder.lte('created_at', `${query.createdTo}T23:59:59Z`);

  const { data, error, count } = await builder;
  if (error) throw error;

  const rows = (data ?? []) as Partial<CustomerRow>[];

  return ok({
    customers: rows.map((row) => ({
      id: row.id,
      customerCode: row.customer_code,
      fullName: row.full_name,
      // Masked in the list. Revealing the full number is a separate, audited action (§19.3).
      mobileLast4: maskLast4(row.mobile ?? null),
      district:
        (row.address_json as { current?: { district?: string } } | undefined)?.current?.district ??
        null,
      verificationStatus: row.verification_status,
      createdAt: row.created_at,
    })),
    total: count ?? rows.length,
  });
});

/**
 * POST /api/customers
 *
 * Creating a customer must take under 30 seconds (§9.2), so only the name is required.
 *
 * Duplicates are surfaced, never blocked: two brothers with similar names at the same address
 * are ordinary, and the operator is the one who knows. Passing `?force=1` records the decision
 * and proceeds.
 */
export const POST = handler('api.customers.create', async (request) => {
  const context = await resolveContext(request);
  requirePermission(context, 'customer.create');

  const force = new URL(request.url).searchParams.get('force') === '1';
  const input = await parseBody(request, createCustomerSchema);

  const entitlements = await loadEntitlementContext(context);
  const limit = checkCustomerLimit(entitlements);
  if (!limit.allowed) throw entitlementExceeded(limit.reason);

  const fullName = normalizeName(input.fullName).value ?? input.fullName;

  if (!force) {
    // Narrow the candidate set in SQL, then score properly in the domain layer.
    const { data: candidates } = await context.supabase
      .from('customers')
      .select('id, full_name, mobile, date_of_birth, father_name, address_json')
      .eq('organization_id', context.organization.id)
      .is('deleted_at', null)
      .limit(200);

    const duplicates = findDuplicates(
      {
        fullName,
        mobile: input.mobile ?? null,
        dateOfBirth: input.dateOfBirth ?? null,
        fatherName: input.fatherName ?? null,
        district: input.address?.current?.district ?? null,
      },
      ((candidates ?? []) as Partial<CustomerRow>[]).map((row): DuplicateCandidateInput => ({
        id: String(row.id),
        fullName: String(row.full_name),
        mobile: row.mobile ?? null,
        dateOfBirth: row.date_of_birth ?? null,
        fatherName: row.father_name ?? null,
        district:
          (row.address_json as { current?: { district?: string } } | undefined)?.current
            ?.district ?? null,
      })),
    );

    if (duplicates.length > 0) {
      // 200 with a warning rather than 409: this is information for the operator, not a failure.
      return ok({ created: false, duplicates });
    }
  }

  const { data, error } = await context.supabase
    .from('customers')
    .insert({
      organization_id: context.organization.id,
      full_name: fullName,
      full_name_hi: input.fullNameHi ?? null,
      mobile: input.mobile ?? null,
      mobile_alt: input.mobileAlt ?? null,
      email: input.email || null,
      date_of_birth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      marital_status: input.maritalStatus ?? null,
      category: input.category ?? null,
      father_name: input.fatherName ?? null,
      mother_name: input.motherName ?? null,
      spouse_name: input.spouseName ?? null,
      guardian_name: input.guardianName ?? null,
      address_json: input.address ?? {},
      identity_summary_json: input.identitySummary ?? {},
      education_json: input.education ?? {},
      certificates_json: input.certificates ?? {},
      notes: input.notes ?? null,
      verification_status: input.sourceDocumentId ? 'extracted' : 'unverified',
      created_by: context.userId,
      updated_by: context.userId,
    })
    .select('id, customer_code, full_name')
    .single();

  if (error) throw error;

  await writeAuditLog(context, {
    action: 'customer.created',
    entityType: 'customer',
    entityId: data.id as string,
    // Which sections were populated, not what was in them.
    metadata: {
      forced: force,
      hasDocumentSource: Boolean(input.sourceDocumentId),
      sections: Object.keys(input).filter((key) => input[key as keyof typeof input] !== undefined)
        .length,
    },
  });

  return created({ created: true, customer: data });
});
