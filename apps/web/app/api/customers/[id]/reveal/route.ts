import { z } from 'zod';
import { getCustomerField, isSensitiveField, notFound } from '@assistigo/core';
import { requirePermission, resolveContext } from '@/lib/api/context';
import { handler, ok, parseBody } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';
import { customerValuesFromRow, decryptFieldValues } from '@/lib/customers/values';
import type { CustomerFieldValueRow, CustomerRow } from '@/lib/supabase/database.types';

const idSchema = z.string().uuid();
const bodySchema = z.object({ fieldKey: z.string().min(1).max(120) });

/**
 * POST /api/customers/:id/reveal
 *
 * Returns the unmasked value of exactly one sensitive field. This is the only path that ever
 * sends a full sensitive value to the client (§19.3), and every call is audited — there is no
 * "reveal all" (docs/SECURITY.md §4).
 */
export const POST = handler(
  'api.customers.reveal',
  async (request, ctx: { params: Promise<{ id: string }> }) => {
    const context = await resolveContext(request);
    requirePermission(context, 'customer.reveal_sensitive');

    const id = idSchema.parse((await ctx.params).id);
    const { fieldKey } = await parseBody(request, bodySchema);

    const field = getCustomerField(fieldKey);
    if (!field || !isSensitiveField(fieldKey)) {
      throw notFound('errors.not_found');
    }

    const { data: customerRow, error: customerError } = await context.supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .eq('organization_id', context.organization.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (customerError) throw customerError;
    if (!customerRow) throw notFound('errors.not_found');

    let value: string | null = null;

    if (field.storage.kind === 'encrypted') {
      const { data: valueRows, error: valueError } = await context.supabase
        .from('customer_field_values')
        .select('field_key, value_encrypted')
        .eq('organization_id', context.organization.id)
        .eq('customer_id', id)
        .eq('field_key', fieldKey);

      if (valueError) throw valueError;

      const decrypted = await decryptFieldValues(
        (valueRows ?? []) as Pick<CustomerFieldValueRow, 'field_key' | 'value_encrypted'>[],
        context.organization.id,
        id,
      );
      value = decrypted[fieldKey] ?? null;
    } else {
      const values = customerValuesFromRow(customerRow as CustomerRow);
      value = values[fieldKey] ?? null;
    }

    await writeAuditLog(context, {
      action: 'customer.sensitive_revealed',
      entityType: 'customer',
      entityId: id,
      // The field key, never the value.
      metadata: { fieldKey },
    });

    return ok({ fieldKey, value });
  },
);
