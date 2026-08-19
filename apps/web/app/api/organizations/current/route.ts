import { z } from 'zod';
import { resolveContext, requirePermission } from '@/lib/api/context';
import { handler, ok, parseBody } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';

const updateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  district: z.string().trim().max(120).nullable().optional(),
  state: z.string().trim().max(120).nullable().optional(),
  preferredLocale: z.enum(['en', 'hi']).optional(),
});

export const GET = handler('api.organizations.current.get', async (request) => {
  const context = await resolveContext(request);
  return ok({ organization: context.organization });
});

export const PATCH = handler('api.organizations.current.patch', async (request) => {
  const context = await resolveContext(request);
  requirePermission(context, 'org.settings');

  const input = await parseBody(request, updateSchema);

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.email !== undefined) patch.email = input.email;
  if (input.city !== undefined) patch.city = input.city;
  if (input.district !== undefined) patch.district = input.district;
  if (input.state !== undefined) patch.state = input.state;
  if (input.preferredLocale !== undefined) patch.preferred_locale = input.preferredLocale;

  const { data, error } = await context.supabase
    .from('organizations')
    .update(patch)
    .eq('id', context.organization.id)
    .select('*')
    .single();

  if (error) throw error;

  await writeAuditLog(context, {
    action: 'organization.updated',
    entityType: 'organization',
    entityId: context.organization.id,
    // Which fields changed, not what they changed to.
    metadata: { fields: Object.keys(patch) },
  });

  return ok({ organization: data });
});
