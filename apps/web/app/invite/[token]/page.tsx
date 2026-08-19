import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { Alert } from '@assistigo/ui';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getTranslations } from '@/lib/i18n/server';
import { logger } from '@/lib/api/logger';

export const metadata = { title: 'Join a workspace' };

const ERROR_MESSAGES: Record<string, string> = {
  ASSISTIGO_INVITE_NOT_FOUND: 'This invitation link is not valid.',
  ASSISTIGO_INVITE_NOT_PENDING: 'This invitation has already been used or was revoked.',
  ASSISTIGO_INVITE_EXPIRED: 'This invitation has expired. Ask for a new one.',
  ASSISTIGO_INVITE_EMAIL_MISMATCH:
    'This invitation was sent to a different email address. Sign in with that address to accept it.',
};

/**
 * Accepts an invitation.
 *
 * The raw token only ever exists in the URL; the database stores its SHA-256. The RPC checks
 * expiry, status, and that the signed-in user's email matches the invited address — so a
 * forwarded link is useless to anyone else.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);

  const tokenHash = createHash('sha256').update(token).digest('hex');

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc('accept_invitation', { p_token_hash: tokenHash });

  if (!error) redirect('/dashboard?joined=1');

  const code = Object.keys(ERROR_MESSAGES).find((key) => error.message.includes(key));
  if (!code) logger.error('invite.accept_failed', { reason: error.message });

  const { t } = await getTranslations();

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
      <Alert tone="danger" title={t('errors.not_found')}>
        {code ? ERROR_MESSAGES[code] : t('errors.internal')}
      </Alert>
    </div>
  );
}
