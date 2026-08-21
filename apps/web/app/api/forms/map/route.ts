import { z } from 'zod';
import {
  checkUsageEntitlement,
  entitlementExceeded,
  notFound,
  previewValue,
} from '@assistigo/core';
import {
  detectionPayloadSchema,
  mergeAdapters,
  proposeMappings,
  selectAdapter,
  type OrgFieldMapping,
  type PortalAdapter,
} from '@assistigo/form-engine';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, ok, parseBody } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';
import {
  customerValuesFromRow,
  unverifiedFieldKeys,
  type CustomerValues,
} from '@/lib/customers/values';
import { loadEntitlementContext } from '@/lib/billing/entitlements';
import type { CustomerRow } from '@/lib/supabase/database.types';

const bodySchema = z.object({
  customerId: z.string().uuid(),
  detection: detectionPayloadSchema,
});

/**
 * POST /api/forms/map
 *
 * Takes field metadata from the extension and returns a mapping proposal plus the values that
 * would be used. Master spec §17.4, §14.3.
 *
 * Note what is *not* in the request: no page HTML, no field values, no query string (§14.2).
 * Values travel only in the response, to the operator who is about to review them.
 */
export const POST = handler('api.forms.map', async (request) => {
  const context = await resolveContext(request);
  requirePermission(context, 'fill.run');

  const { customerId, detection } = await parseBody(request, bodySchema);

  // Entitlement is checked before any work is done, so an out-of-credit organization gets a
  // clear answer rather than a proposal it cannot act on (§22.4).
  const entitlements = await loadEntitlementContext(context);
  const decision = checkUsageEntitlement(entitlements, 'fill');
  if (!decision.allowed) throw entitlementExceeded(decision.reason);

  const [customerResult, fieldValuesResult, adaptersResult, orgMappingsResult] = await Promise.all([
    context.supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .eq('organization_id', context.organization.id)
      .is('deleted_at', null)
      .maybeSingle(),
    context.supabase
      .from('customer_field_values')
      .select('field_key, status, display_value, value_text')
      .eq('organization_id', context.organization.id)
      .eq('customer_id', customerId),
    context.supabase
      .from('portal_adapters')
      .select('*')
      .in('status', ['active', 'testing'])
      .or(`organization_id.is.null,organization_id.eq.${context.organization.id}`),
    context.supabase
      .from('org_field_mappings')
      .select('page_origin, field_signature, customer_field, transform')
      .eq('organization_id', context.organization.id)
      .eq('page_origin', detection.page.origin),
  ]);

  const customer = customerResult.data as CustomerRow | null;
  if (!customer) throw notFound('errors.customer_not_found');

  const fieldValueRows = (fieldValuesResult.data ?? []) as {
    field_key: string;
    status: string;
    display_value: string | null;
    value_text: string | null;
  }[];

  const values: CustomerValues = customerValuesFromRow(customer);

  // Operator-verified values from the provenance table win over the profile columns: they are
  // the ones a human has explicitly confirmed against a document.
  for (const row of fieldValueRows) {
    if (row.status === 'operator_verified' || row.status === 'customer_confirmed') {
      if (row.value_text) values[row.field_key] = row.value_text;
    }
  }

  const adapterRows = (adaptersResult.data ?? []) as Record<string, unknown>[];

  const databaseAdapters = adapterRows
    /*
     * Global rows first so that `mergeAdapters` — last-wins by slug — lets an organization's own
     * patched copy of an adapter beat the global one. The query is a single `.or()`, and
     * Postgres makes no promise about the order two branches of it come back in.
     */
    .slice()
    .sort((a, b) => Number(a.organization_id != null) - Number(b.organization_id != null))
    .map(
      (row) =>
        ({
          id: String(row.id),
          slug: String(row.slug),
          portalName: String(row.portal_name),
          formName: String(row.form_name),
          region: row.region as string | undefined,
          urlPatterns: (row.url_patterns as string[]) ?? [],
          version: String(row.version),
          status: row.status as PortalAdapter['status'],
          fields: (row.field_mappings as PortalAdapter['fields']) ?? [],
          documentRequirements:
            (row.document_requirements as PortalAdapter['documentRequirements']) ?? [],
        }) satisfies PortalAdapter,
    );

  /*
   * The adapters that ship with the build are the floor, not the ceiling: an unseeded database
   * used to mean "no portal is supported", which is a silent, total loss of the feature on any
   * deployment whose seed had not been run. A database row for the same slug still wins.
   */
  const adapters = mergeAdapters(databaseAdapters);
  const adapter = selectAdapter(adapters, detection.page.origin, detection.page.path);

  /*
   * `fill_sessions.portal_adapter_id` is a foreign key, so it may only name an adapter that is
   * actually a row. A built-in that has not been seeded yet still maps the form; it just does
   * not get credited in the session, and adapter health for it stays blank until it is seeded.
   */
  const persistedAdapterId =
    adapter && databaseAdapters.some((candidate) => candidate.id === adapter.id)
      ? adapter.id
      : null;

  const orgMappings = ((orgMappingsResult.data ?? []) as Record<string, unknown>[]).map(
    (row) =>
      ({
        pageOrigin: String(row.page_origin),
        fieldSignature: String(row.field_signature),
        customerField: String(row.customer_field),
        transform: (row.transform as string | undefined) ?? undefined,
      }) satisfies OrgFieldMapping,
  );

  const settings = (context.organization.settings ?? {}) as { overwrite_filled_fields?: boolean };

  const proposal = proposeMappings({
    detection,
    customerValues: values,
    unverifiedFields: unverifiedFieldKeys(fieldValueRows),
    adapter,
    orgMappings,
    overwriteFilled: settings.overwrite_filled_fields === true,
  });

  // Open the fill session now, so a fill that is started and abandoned is still visible to the
  // operator and to adapter health (§18.2).
  const { data: session, error } = await context.supabase
    .from('fill_sessions')
    .insert({
      organization_id: context.organization.id,
      customer_id: customerId,
      portal_adapter_id: persistedAdapterId,
      page_origin: detection.page.origin,
      page_path: detection.page.path,
      page_title: detection.page.title,
      detected_fields_count: proposal.summary.detected,
      proposed_fields_count: proposal.summary.proposed,
      review_required_count: proposal.summary.needsReview,
      captcha_fields_count: proposal.summary.captcha,
      otp_fields_count: proposal.summary.otp,
      payment_fields_count: proposal.summary.payment,
      status: 'detected',
      extension_version: detection.extensionVersion ?? null,
      created_by: context.userId,
    })
    .select('id')
    .single();

  if (error) throw error;

  await writeAuditLog(context, {
    action: 'fill_session.started',
    entityType: 'fill_session',
    entityId: session.id as string,
    metadata: {
      pageOrigin: detection.page.origin,
      adapterId: persistedAdapterId,
      detected: proposal.summary.detected,
      proposed: proposal.summary.proposed,
    },
  });

  // Only the values for fields that were actually mapped are returned — not the customer's
  // whole profile.
  const usedValues: CustomerValues = {};
  for (const mapping of proposal.mappings) {
    if (mapping.customerField && values[mapping.customerField] !== undefined) {
      usedValues[mapping.customerField] = values[mapping.customerField] as string;
    }
  }

  return ok({
    fillSessionId: session.id,
    adapter: adapter
      ? { id: adapter.id, portalName: adapter.portalName, formName: adapter.formName }
      : null,
    mappings: proposal.mappings,
    fillOrder: proposal.fillOrder,
    summary: proposal.summary,
    values: usedValues,
    /** Masked previews, safe to render in a log or a dashboard list. */
    previews: Object.fromEntries(
      Object.entries(usedValues).map(([key, value]) => [key, previewValue(value)]),
    ),
  });
});
