import { z } from 'zod';
import { unauthenticated, validationFailed } from '@assistigo/core';
import { resolveContext } from '@/lib/api/context';
import { handler, ok, parseBody } from '@/lib/api/response';
import { writeAuditLog } from '@/lib/api/audit';
import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabase/server';
import {
  PAIRING_CODE_TTL_MS,
  hashPairingCode,
  newPairingCode,
  resolveExtensionId,
  sealSession,
} from '@/lib/extension/pairing';

/**
 * POST /api/extension/pairing-code
 *
 * Called by /extension/connect, with the dashboard's own cookies. Mints the one-time code the
 * service worker will exchange at /api/extension/pair (docs/EXTENSION.md §3).
 *
 * The code is returned to the page exactly once and never stored in plaintext. The session it
 * guards is encrypted at rest for the two minutes the code is alive.
 */

const bodySchema = z.object({
  /** The extension asking to be paired. Checked against EXTENSION_ALLOWED_IDS. */
  extensionId: z.string().max(64),
});

export const POST = handler('extension.pairing_code', async (request) => {
  const { extensionId } = await parseBody(request, bodySchema);

  // Gate first: a crafted /extension/connect?ext=<attacker-id> link must never reach the point
  // where a real code exists.
  if (!resolveExtensionId(extensionId)) {
    throw validationFailed({ fields: { extensionId: 'extension.unknown_extension' } });
  }

  // resolveContext verifies the JWT and the membership, and is what makes this route safe to
  // hand out a session from.
  const context = await resolveContext(request);

  // Cookies only. An already-paired extension presenting a bearer token must not be able to
  // mint a fresh code — pairing has to start from a browser the operator signed into.
  if (context.actorType !== 'user') throw unauthenticated();

  // resolveContext already verified this user against the auth server; getSession() is only
  // being used to read those same, already-verified tokens out of the cookie store.
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token || !session.refresh_token) throw unauthenticated();

  const code = newPairingCode();
  const codeHash = hashPairingCode(code);

  const sessionPayload = await sealSession(
    {
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      expiresAt: session.expires_at
        ? session.expires_at * 1000
        : Date.now() + (session.expires_in ?? 3600) * 1000,
    },
    codeHash,
  );

  // Service role: extension_pairing_codes has RLS on and no policies, so no user JWT can read
  // or write it (migration 0012).
  const admin = createSupabaseAdminClient();

  // One live code per user — supersede an abandoned connect tab rather than leaving a second
  // redeemable code behind.
  await admin
    .from('extension_pairing_codes')
    .delete()
    .eq('user_id', context.userId)
    .is('consumed_at', null);

  const { error } = await admin.from('extension_pairing_codes').insert({
    code_hash: codeHash,
    user_id: context.userId,
    session_payload: sessionPayload,
    expires_at: new Date(Date.now() + PAIRING_CODE_TTL_MS).toISOString(),
  });

  if (error) throw error;

  await writeAuditLog(context, {
    action: 'extension.paired',
    entityType: 'user',
    entityId: context.userId,
    metadata: { extensionId },
  });

  return ok({ code, expiresInMs: PAIRING_CODE_TTL_MS });
});
