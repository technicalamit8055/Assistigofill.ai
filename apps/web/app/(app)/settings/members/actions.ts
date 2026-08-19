'use server';

import { randomBytes, createHash } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { ASSIGNABLE_ROLES, can, isOrgRole, type OrgRole } from '@assistigo/core';
import { requireSession } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logger } from '@/lib/api/logger';
import { publicEnv } from '@/lib/env';

export type MembersState = {
  error?: string;
  notice?: string;
  /**
   * The invitation link. Shown in the UI because no transactional email provider is wired up
   * yet — the `notification.send` job (docs/ARCHITECTURE.md §7) will deliver these once it is,
   * and this field goes away.
   */
  inviteUrl?: string;
};

const INVITE_TTL_DAYS = 7;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('validation.email_invalid'),
  role: z.enum(['manager', 'operator', 'viewer', 'billing_admin']),
});

const memberIdSchema = z.string().uuid();

/** The raw token goes in the link; only its hash is stored (spec §19.4). */
function newInviteToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export async function inviteMemberAction(
  _prev: MembersState,
  formData: FormData,
): Promise<MembersState> {
  const session = await requireSession();

  if (!can(session.role, 'member.invite')) return { error: 'errors.permission_denied' };

  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'errors.validation_failed' };
  }

  // A manager may staff the centre but may never mint another owner (§6.2).
  if (!ASSIGNABLE_ROLES[session.role].includes(parsed.data.role)) {
    return { error: 'errors.permission_denied' };
  }

  const supabase = await createSupabaseServerClient();
  const { token, hash } = newInviteToken();

  const { data, error } = await supabase
    .from('organization_invitations')
    .insert({
      organization_id: session.organization.id,
      email: parsed.data.email,
      role: parsed.data.role,
      token_hash: hash,
      invited_by: session.userId,
      expires_at: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000).toISOString(),
    })
    .select('id')
    .single();

  if (error || !data) {
    logger.error('member.invite_failed', { reason: error?.message });
    return { error: 'errors.internal' };
  }

  await supabase.from('audit_logs').insert({
    organization_id: session.organization.id,
    actor_user_id: session.userId,
    actor_type: 'user',
    action: 'member.invited',
    entity_type: 'organization_member',
    entity_id: data.id,
    sensitivity: 'sensitive',
    // Note the role but not the invitee's email address.
    metadata: { role: parsed.data.role },
  });

  revalidatePath('/settings/members');

  return {
    notice: 'settings.inviteSent',
    inviteUrl: `${publicEnv().NEXT_PUBLIC_APP_URL}/invite/${token}`,
  };
}

export async function revokeInvitationAction(
  _prev: MembersState,
  formData: FormData,
): Promise<MembersState> {
  const session = await requireSession();
  if (!can(session.role, 'member.invite')) return { error: 'errors.permission_denied' };

  const id = memberIdSchema.safeParse(formData.get('invitationId'));
  if (!id.success) return { error: 'errors.validation_failed' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('organization_invitations')
    .update({ status: 'revoked' })
    .eq('id', id.data)
    .eq('organization_id', session.organization.id)
    .eq('status', 'pending');

  if (error) {
    logger.error('member.invite_revoke_failed', { reason: error.message });
    return { error: 'errors.internal' };
  }

  revalidatePath('/settings/members');
  return {};
}

export async function changeMemberRoleAction(
  _prev: MembersState,
  formData: FormData,
): Promise<MembersState> {
  const session = await requireSession();
  if (!can(session.role, 'member.change_role')) return { error: 'errors.permission_denied' };

  const memberId = memberIdSchema.safeParse(formData.get('memberId'));
  const nextRole = formData.get('role');

  if (!memberId.success || typeof nextRole !== 'string' || !isOrgRole(nextRole)) {
    return { error: 'errors.validation_failed' };
  }

  if (!ASSIGNABLE_ROLES[session.role].includes(nextRole as OrgRole)) {
    return { error: 'errors.permission_denied' };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('organization_members')
    .update({ role: nextRole })
    .eq('id', memberId.data)
    .eq('organization_id', session.organization.id);

  if (error) {
    // The database refuses to leave an organization without an owner; surface that plainly
    // rather than as a generic failure.
    if (error.message.includes('ASSISTIGO_LAST_OWNER')) return { error: 'settings.lastOwner' };
    logger.error('member.role_change_failed', { reason: error.message });
    return { error: 'errors.internal' };
  }

  await supabase.from('audit_logs').insert({
    organization_id: session.organization.id,
    actor_user_id: session.userId,
    actor_type: 'user',
    action: 'member.role_changed',
    entity_type: 'organization_member',
    entity_id: memberId.data,
    sensitivity: 'critical',
    metadata: { newRole: nextRole },
  });

  revalidatePath('/settings/members');
  return {};
}

export async function removeMemberAction(
  _prev: MembersState,
  formData: FormData,
): Promise<MembersState> {
  const session = await requireSession();
  if (!can(session.role, 'member.remove')) return { error: 'errors.permission_denied' };

  const memberId = memberIdSchema.safeParse(formData.get('memberId'));
  if (!memberId.success) return { error: 'errors.validation_failed' };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('organization_members')
    .delete()
    .eq('id', memberId.data)
    .eq('organization_id', session.organization.id);

  if (error) {
    if (error.message.includes('ASSISTIGO_LAST_OWNER')) return { error: 'settings.lastOwner' };
    logger.error('member.remove_failed', { reason: error.message });
    return { error: 'errors.internal' };
  }

  await supabase.from('audit_logs').insert({
    organization_id: session.organization.id,
    actor_user_id: session.userId,
    actor_type: 'user',
    action: 'member.removed',
    entity_type: 'organization_member',
    entity_id: memberId.data,
    sensitivity: 'sensitive',
    metadata: {},
  });

  revalidatePath('/settings/members');
  return {};
}
