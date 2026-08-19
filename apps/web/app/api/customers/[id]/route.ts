import { z } from 'zod';
import {
  isSensitiveField,
  maskAccountNumber,
  maskAadhaar,
  maskEmail,
  maskMobile,
  maskPan,
  normalizeName,
  notFound,
  updateCustomerSchema,
} from '@assistigo/core';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, noContent, ok, parseBody } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';
import { customerValuesFromRow, unverifiedFieldKeys } from '@/lib/customers/values';
import type { CustomerFieldValueRow, CustomerRow, Json } from '@/lib/supabase/database.types';

const idSchema = z.string().uuid();

async function loadCustomer(
  context: Awaited<ReturnType<typeof resolveContext>>,
  id: string,
): Promise<CustomerRow> {
  const { data, error } = await context.supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .eq('organization_id', context.organization.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw notFound('errors.not_found');
  return data as CustomerRow;
}

/**
 * Masks any field the registry marks sensitive before it leaves the server. The unmasked
 * form is only ever sent by POST /api/customers/:id/reveal, which is a separate, audited action.
 */
function maskSensitiveValues(values: Record<string, string>): Record<string, string> {
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!isSensitiveField(key)) {
      masked[key] = value;
      continue;
    }
    if (key === 'customer.mobile' || key === 'customer.mobile_alt') {
      masked[key] = maskMobile(value) ?? '';
    } else if (key === 'customer.email') {
      masked[key] = maskEmail(value) ?? '';
    } else if (key === 'customer.aadhaar_last4') {
      masked[key] = maskAadhaar(value) ?? '';
    } else if (key === 'customer.pan') {
      masked[key] = maskPan(value) ?? '';
    } else if (key === 'customer.bank.account_number') {
      masked[key] = maskAccountNumber(value) ?? '';
    } else {
      masked[key] = '••••';
    }
  }
  return masked;
}

/** GET /api/customers/:id — profile detail, sensitive fields masked (§19.3). */
export const GET = handler(
  'api.customers.get',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'customer.view');

    const id = idSchema.parse((await ctx.params).id);
    const customer = await loadCustomer(context, id);

    const { data: fieldValueRows } = await context.supabase
      .from('customer_field_values')
      .select('field_key, value_text, value_encrypted, status')
      .eq('organization_id', context.organization.id)
      .eq('customer_id', id);

    const rows = (fieldValueRows ?? []) as Partial<CustomerFieldValueRow>[];

    const values = customerValuesFromRow(customer);
    for (const row of rows) {
      // Encrypted values never surface here — only whether one exists, so the profile UI can
      // still show a masked placeholder and a reveal action.
      if (row.field_key && row.value_text) values[row.field_key] = row.value_text;
    }

    const encryptedKeysWithValue = new Set(
      rows.filter((row) => row.value_encrypted).map((row) => row.field_key as string),
    );

    return ok({
      customer: {
        id: customer.id,
        customerCode: customer.customer_code,
        fullName: customer.full_name,
        verificationStatus: customer.verification_status,
        createdAt: customer.created_at,
        updatedAt: customer.updated_at,
        notes: customer.notes,
      },
      values: maskSensitiveValues(values),
      encryptedFieldsPresent: [...encryptedKeysWithValue],
      unverifiedFieldKeys: [
        ...unverifiedFieldKeys(
          rows
            .filter((row) => row.field_key && row.status)
            .map((row) => ({ field_key: row.field_key as string, status: row.status as string })),
        ),
      ],
    });
  },
);

/** PATCH /api/customers/:id — partial profile update. */
export const PATCH = handler(
  'api.customers.update',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'customer.update');

    const id = idSchema.parse((await ctx.params).id);
    await loadCustomer(context, id);

    const input = await parseBody(request, updateCustomerSchema);

    const patch: Record<string, unknown> = { updated_by: context.userId };
    if (input.fullName !== undefined) patch.full_name = normalizeName(input.fullName).value;
    if (input.fullNameHi !== undefined) patch.full_name_hi = input.fullNameHi || null;
    if (input.mobile !== undefined) patch.mobile = input.mobile;
    if (input.mobileAlt !== undefined) patch.mobile_alt = input.mobileAlt;
    if (input.email !== undefined) patch.email = input.email || null;
    if (input.dateOfBirth !== undefined) patch.date_of_birth = input.dateOfBirth;
    if (input.gender !== undefined) patch.gender = input.gender;
    if (input.maritalStatus !== undefined) patch.marital_status = input.maritalStatus;
    if (input.category !== undefined) patch.category = input.category;
    if (input.fatherName !== undefined) patch.father_name = input.fatherName;
    if (input.motherName !== undefined) patch.mother_name = input.motherName;
    if (input.spouseName !== undefined) patch.spouse_name = input.spouseName;
    if (input.guardianName !== undefined) patch.guardian_name = input.guardianName;
    if (input.address !== undefined) patch.address_json = input.address as unknown as Json;
    if (input.identitySummary !== undefined) {
      patch.identity_summary_json = input.identitySummary as unknown as Json;
    }
    if (input.education !== undefined) patch.education_json = input.education as unknown as Json;
    if (input.certificates !== undefined) {
      patch.certificates_json = input.certificates as unknown as Json;
    }
    if (input.notes !== undefined) patch.notes = input.notes || null;

    const { data, error } = await context.supabase
      .from('customers')
      .update(patch)
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .select('id')
      .single();

    if (error) throw error;

    await writeAuditLog(context, {
      action: 'customer.updated',
      entityType: 'customer',
      entityId: id,
      metadata: { fields: Object.keys(patch).filter((key) => key !== 'updated_by') },
    });

    return ok({ id: data.id });
  },
);

/** DELETE /api/customers/:id — soft delete (§18.2: customers carry deleted_at, never hard-deleted). */
export const DELETE = handler(
  'api.customers.delete',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'customer.delete');

    const id = idSchema.parse((await ctx.params).id);
    await loadCustomer(context, id);

    const { error } = await context.supabase
      .from('customers')
      .update({ deleted_at: new Date().toISOString(), updated_by: context.userId })
      .eq('id', id)
      .eq('organization_id', context.organization.id);

    if (error) throw error;

    await writeAuditLog(context, {
      action: 'customer.deleted',
      entityType: 'customer',
      entityId: id,
      metadata: {},
    });

    return noContent();
  },
);
